<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * How a musician's instrument reaches the desk.
 *
 * Keep in sync with the frontend union `SignalChainType`
 * (app/src/types/rig.ts) and the channel presets that build an input list
 * from it (app/src/utils/signalChainPresets.ts).
 */
enum SignalChainType: string
{
    case ModelerMono    = 'modeler_mono';
    case ModelerStereo  = 'modeler_stereo';
    case AmpMic         = 'amp_mic';
    case AmpMicDi       = 'amp_mic_di';
    case AmpDi          = 'amp_di';
    case DirectMono     = 'direct_mono';
    case DirectStereo   = 'direct_stereo';
    case DrumAcoustic   = 'drum_acoustic';
    case DrumElectronic = 'drum_electronic';
    case DrumHybrid     = 'drum_hybrid';
    case VocalMic       = 'vocal_mic';
    case VocalWireless  = 'vocal_wireless';
    case AcousticDi     = 'acoustic_di';
    case AcousticMic    = 'acoustic_mic';
    case AcousticMicDi  = 'acoustic_mic_di';
    case Other          = 'other';

    /** @return string[] */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
