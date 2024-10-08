@echo off

:: Activate emscripten
call ./emsdk/emsdk activate latest

echo Compiling ASTC to JavaScript

:: Compile
em++ astc\compress_block.cpp astc\compress_texture.cpp image\bgra.cc image\compressed.cc compress\astc.cc -sEXPORTED_FUNCTIONS=_toASTC,_malloc,_free -sEXPORTED_RUNTIME_METHODS=ccall,cwrap -sALLOW_MEMORY_GROWTH -o ../public/astccrt.js