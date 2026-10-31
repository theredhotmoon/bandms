<?php

namespace App\Assistant\Crawler;

/** The provider said its quota is spent (429, quotaExceeded…): end the run `capped`, not `failed`. */
final class SourceCapped extends \RuntimeException {}
