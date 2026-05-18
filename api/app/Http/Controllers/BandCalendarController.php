<?php

namespace App\Http\Controllers;

use App\Models\BandMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Sabre\VObject\Reader;

class BandCalendarController extends Controller
{
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

    /** Public: availability check for a single date. */
    public function availability(Request $request): JsonResponse
    {
        $data = $request->validate(['date' => 'required|date']);

        $members = BandMember::where('is_current', true)
            ->whereNotNull('calendar_url')
            ->orderBy('sort_order')
            ->get();

        $dayEnd      = date('Y-m-d', strtotime($data['date'] . ' +1 day'));
        $busyMembers = [];

        foreach ($members as $member) {
            $events = $this->parseMemberCalendar($member, $data['date'], $dayEnd);
            if (!empty($events)) {
                $busyMembers[] = [
                    'id'   => $member->id,
                    'name' => $member->first_name . ' ' . $member->last_name,
                    'role' => $member->role,
                ];
            }
        }

        return response()->json([
            'data' => [
                'date'          => $data['date'],
                'available'     => empty($busyMembers),
                'total_members' => $members->count(),
                'busy_count'    => count($busyMembers),
                'busy_members'  => $busyMembers,
            ],
        ]);
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
