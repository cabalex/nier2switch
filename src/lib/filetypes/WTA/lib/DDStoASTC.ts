import { loadDDS } from './DDS'

declare global {
    interface Window {
        Module: any;
    }
}


let load = (bufferPtr: number, bufferSize: number, width: number, height: number, alpha: boolean) => -1

// Converts a DDS texture to 4x4 ASTC.
// DDS header MUST be presliced (0x80).
export default function imageBufferToASTC(format: string, width: number, height: number, depth: number, textureData: ArrayBuffer) {
    let canvas = loadDDS(format, width, height, depth, textureData);
    
    if (!window.Module) {
        console.error('ASTC compression WASM not found... is it loaded?');
        return null
    }
    
    load = window.Module.cwrap('toASTC', 'number', ['number', 'number', 'number', 'number', 'boolean'])

    let ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let imageData = ctx.getImageData(0, 0, width, height);
    let buffer = new Uint8Array(imageData.data);

    let bufferPtr = window.Module._malloc(buffer.byteLength);
    window.Module.HEAPU8.set(buffer, bufferPtr);

    let resultSize;
    try {
        resultSize = load(bufferPtr, buffer.byteLength, width, height, true);
    } catch (e) {
        console.error("ASTC compression failed, trying without alpha...");
        resultSize = load(bufferPtr, buffer.byteLength, width, height, false);
    }

    if (resultSize < 0) {
        window.Module._free(bufferPtr);
        return null;
    }

    let result = new Uint8Array(window.Module.HEAPU8.buffer, bufferPtr, resultSize);

    // should always be smaller than the original size, so no memory leak maybe?
    window.Module._free(bufferPtr);

    return result;
}