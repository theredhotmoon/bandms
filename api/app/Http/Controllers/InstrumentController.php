<?php

namespace App\Http\Controllers;

use App\Models\Instrument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InstrumentController extends Controller
{
    public function index(): JsonResponse
    {
        $instruments = Instrument::orderBy('category')->orderBy('name')->get();

        return response()->json($instruments);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:100', 'unique:instruments,name'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $instrument = Instrument::create($data);

        return response()->json($instrument, 201);
    }

    public function update(Request $request, Instrument $instrument): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['sometimes', 'required', 'string', 'max:100', 'unique:instruments,name,' . $instrument->id],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $instrument->update($data);

        return response()->json($instrument);
    }

    public function destroy(Instrument $instrument): JsonResponse
    {
        $instrument->delete();

        return response()->json(null, 204);
    }
}
