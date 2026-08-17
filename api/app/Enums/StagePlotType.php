<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Visual icon type for a stage-plot instrument slot.
 *
 * Keep in sync with the frontend union `StagePlotItemType`
 * (app/src/types/techRider.ts) and the icon catalogue
 * (app/src/utils/instrumentIcons.ts).
 */
enum StagePlotType: string
{
    // vocals
    case Vocalist       = 'vocalist';
    case BackingVocals  = 'backing_vocals';

    // guitars & bass
    case ElectricGuitar = 'electric_guitar';
    case AcousticGuitar = 'acoustic_guitar';
    case BassGuitar     = 'bass_guitar';
    case Banjo          = 'banjo';

    // keys
    case Keyboard       = 'keyboard';
    case Piano          = 'piano';
    case Synth          = 'synth';
    case Accordion      = 'accordion';

    // brass & wind
    case Trumpet        = 'trumpet';
    case Trombone       = 'trombone';
    case Saxophone      = 'saxophone';
    case Flute          = 'flute';
    case Clarinet       = 'clarinet';
    case Harmonica      = 'harmonica';
    case Brass          = 'brass';

    // strings
    case Violin         = 'violin';
    case Cello          = 'cello';
    case DoubleBass     = 'double_bass';

    // percussion
    case Drums          = 'drums';
    case Percussion     = 'percussion';
    case Cajon          = 'cajon';

    // electronic
    case DjDeck         = 'dj_deck';
    case Laptop         = 'laptop';

    // stage gear
    case GuitarAmp      = 'guitar_amp';
    case BassAmp        = 'bass_amp';
    case MonitorWedge   = 'monitor_wedge';
    case DiBox          = 'di_box';
    case Rack           = 'rack';

    // fallback
    case Custom         = 'custom';

    /** @return string[] */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
