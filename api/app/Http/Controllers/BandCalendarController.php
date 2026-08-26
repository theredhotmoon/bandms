<?php

namespace App\Http\Controllers;

use App\Models\BandMember;
use App\Models\Concert;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Sabre\VObject\Reader;

class BandCalendarController extends Controller
{
    private const MAX_RANGE_DAYS = 92;

    private array $colors = [
        '#6366f1', '#f59e0b', '#10b981', '#f43f5e',
        '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    ];

    /** Admin: all active members' events in a date range. */
    public function events(Request $request): JsonResponse
    {
        $data = $request->validate([
            'start' => 'required|date',
            'end'   => 'required|date|after:start',
        ]);

        $members = BandMember::where('is_current', true)
            ->whereNotNull('calendar_url')
            ->orderBy('sort_order')
            ->get();

        $events = [];
        foreach ($members as $index => $member) {
            $color        = $this->colors[$index % count($this->colors)];
            $memberEvents = $this->parseMemberCalendar($member, $data['start'], $data['end'], $color);
            $events       = array_merge($events, $memberEvents);
        }

        return response()->json(['data' => $events]);
    }

    /**
     * Public: availability check for a single date.
     *
     * This endpoint is unauthenticated. It used to return `busy_members` with
     * each member's full name and role, which let anyone enumerate which
     * musician was unavailable on which day — a private-calendar leak dressed
     * as a booking convenience. It now reports only the aggregate, which is all
     * a promoter ever needed.
     */
    public function availability(Request $request): JsonResponse
    {
        $data = $request->validate(['date' => 'required|date']);

        $members = BandMember::where('is_current', true)
            ->whereNotNull('calendar_url')
            ->orderBy('sort_order')
            ->get();

        $dayEnd    = date('Y-m-d', strtotime($data['date'] . ' +1 day'));
        $busyCount = 0;

        foreach ($members as $member) {
            if (!empty($this->parseMemberCalendar($member, $data['date'], $dayEnd))) {
                $busyCount++;
            }
        }

        return response()->json([
            'data' => [
                'date'          => $data['date'],
                'available'     => $busyCount === 0,
                'total_members' => $members->count(),
                'busy_count'    => $busyCount,
            ],
        ]);
    }

    /**
     * Public: day-by-day availability across a range, for the booking calendar.
     *
     * The single-date endpoint above cannot back a month grid: it would take 30
     * requests, each re-parsing every member's remote iCal feed. This walks all
     * members once for the whole window instead.
     *
     * Statuses are deliberately coarse — `booked` (a concert is on the books),
     * `held` (at least one member is busy) and `open`. Nothing identifies WHICH
     * member is busy, or how many; see the note on availability() above.
     */
    public function availabilityRange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'start' => ['required', 'date'],
            'end'   => ['required', 'date', 'after:start'],
        ]);

        $start = new \DateTimeImmutable($data['start']);
        $end   = new \DateTimeImmutable($data['end']);

        // A calendar UI never needs more than a few months, and each extra day
        // is remote iCal parsing. Cap rather than let a crafted range hang the
        // request.
        if ($start->diff($end)->days > self::MAX_RANGE_DAYS) {
            return response()->json([
                'message' => 'Range may not exceed ' . self::MAX_RANGE_DAYS . ' days.',
            ], 422);
        }

        $startStr = $start->format('Y-m-d');
        $endStr   = $end->format('Y-m-d');

        $payload = Cache::remember(
            "availability_range_{$startStr}_{$endStr}",
            300,
            function () use ($start, $end, $startStr, $endStr) {
                $busy = [];
                $members = BandMember::where('is_current', true)
                    ->whereNotNull('calendar_url')
                    ->get();

                foreach ($members as $member) {
                    foreach ($this->parseMemberCalendar($member, $startStr, $endStr) as $event) {
                        // Events carry either a date or a full timestamp; the
                        // first 10 chars are the day in both shapes.
                        $busy[substr((string) $event['start'], 0, 10)] = true;
                    }
                }

                $booked = Concert::whereBetween('date', [$startStr, $endStr])
                    ->pluck('date')
                    ->map(fn ($d) => $d instanceof \DateTimeInterface ? $d->format('Y-m-d') : substr((string) $d, 0, 10))
                    ->flip()
                    ->all();

                $days = [];
                for ($d = $start; $d <= $end; $d = $d->modify('+1 day')) {
                    $key = $d->format('Y-m-d');

                    $days[] = [
                        'date'   => $key,
                        'status' => match (true) {
                            isset($booked[$key]) => 'booked',
                            isset($busy[$key])   => 'held',
                            default              => 'open',
                        },
                    ];
                }

                return $days;
            }
        );

        return response()->json(['data' => $payload]);
    }

    /**
     * Convert Google Calendar web viewer URLs to iCal feed URLs.
     *
     * Web URL: https://calendar.google.com/calendar/u/0?cid=BASE64_CALENDAR_ID
     * iCal URL: https://calendar.google.com/calendar/ical/CALENDAR_ID/public/basic.ics
     *
     * The cid param is the calendar ID base64-encoded (e.g. email@gmail.com).
     */
    private function normalizeCalendarUrl(string $url): string
    {
        if (!str_contains($url, 'calendar.google.com')) {
            return $url;
        }

        // Already an iCal feed — nothing to do
        if (str_ends_with($url, '.ics')) {
            return $url;
        }

        $parsed = parse_url($url);
        if (!empty($parsed['query'])) {
            parse_str($parsed['query'], $params);
            if (!empty($params['cid'])) {
                $calendarId = base64_decode($params['cid'], strict: false);
                if ($calendarId) {
                    return 'https://calendar.google.com/calendar/ical/' . urlencode($calendarId) . '/public/basic.ics';
                }
            }
        }

        return $url;
    }

    private function parseMemberCalendar(
        BandMember $member,
        string $start,
        string $end,
        string $color = '#6366f1'
    ): array {
        try {
            $feedUrl = $this->normalizeCalendarUrl($member->calendar_url);

            // Key includes a hash of the feed URL so changing the URL auto-invalidates the cache.
            $cacheKey = 'ical_member_' . $member->id . '_' . md5($feedUrl);
            $ical = Cache::remember(
                $cacheKey,
                300,
                fn () => Http::timeout(15)->get($feedUrl)->body()
            );

            if (!$ical || !str_contains($ical, 'BEGIN:VCALENDAR')) {
                Log::warning("Member {$member->id} calendar_url did not return iCal data. URL: {$feedUrl}");
                return [];
            }

            $vcalendar = Reader::read($ical, Reader::OPTION_FORGIVING);
            $startDt   = new \DateTimeImmutable($start, new \DateTimeZone('UTC'));
            $endDt     = new \DateTimeImmutable($end,   new \DateTimeZone('UTC'));
            $expanded  = $vcalendar->expand($startDt, $endDt);

            if (!isset($expanded->VEVENT)) return [];

            $events = [];
            foreach ($expanded->VEVENT as $vevent) {
                $dtStart  = $vevent->DTSTART->getDateTime();
                $isAllDay = !$vevent->DTSTART->hasTime();
                $dtEnd    = isset($vevent->DTEND) ? $vevent->DTEND->getDateTime() : null;
                $summary  = isset($vevent->SUMMARY) ? (string) $vevent->SUMMARY : '';
                $uid      = isset($vevent->UID) ? (string) $vevent->UID : uniqid();

                $events[] = [
                    'id'     => $member->id . '-' . md5($uid . $dtStart->format('c')),
                    'title'  => $member->first_name . ': ' . ($summary ?: 'Busy'),
                    'start'  => $isAllDay ? $dtStart->format('Y-m-d') : $dtStart->format('c'),
                    'end'    => $dtEnd
                        ? ($isAllDay ? $dtEnd->format('Y-m-d') : $dtEnd->format('c'))
                        : null,
                    'allDay' => $isAllDay,
                    'color'  => $color,
                    'extendedProps' => [
                        'memberId'    => $member->id,
                        'memberName'  => $member->first_name . ' ' . $member->last_name,
                        'memberRole'  => $member->role,
                        'description' => isset($vevent->DESCRIPTION) ? (string) $vevent->DESCRIPTION : null,
                    ],
                ];
            }

            return $events;

        } catch (\Throwable $e) {
            Log::warning("Calendar parse failed for member {$member->id}: " . $e->getMessage());
            return [];
        }
    }
}
