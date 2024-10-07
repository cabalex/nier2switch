import PlatinumFileReader from "../PlatinumFileReader";
import { concatArrayBuffer } from "../arrayBufferTools";
import { compressImageData } from "./lib/tegrax1swizzle";

const formats = {
	// DDS
	0x25: "R8G8B8A8_UNORM",
	0x42: "BC1_UNORM",
	0x43: "BC2_UNORM",
	0x44: "BC3_UNORM",
	0x45: "BC4_UNORM",
	0x46: "BC1_UNORM_SRGB",
	0x47: "BC2_UNORM_SRGB",
	0x48: "BC3_UNORM_SRGB",
	0x49: "BC4_SNORM",
	0x50: "BC6H_UF16",
	// ASTC (weird texture formats ??)
	0x2D: "ASTC_4x4_UNORM",
	0x38: "ASTC_8x8_UNORM",
	0x3A: "ASTC_12x12_UNORM",
	// ASTC
	0x79: "ASTC_4x4_UNORM",
	0x80: "ASTC_8x8_UNORM",
	0x87: "ASTC_4x4_SRGB",
	0x8E: "ASTC_8x8_SRGB",

	// Unknown NieR switch formats
    0x7D: "ASTC_6x6_UNORM",
    0x8B: "ASTC_6x6_SRGB",
}


export async function convert_full(wtaFile: ArrayBuffer, wtpFile: ArrayBuffer): Promise<[ArrayBuffer, ArrayBuffer]> {
    let wta = new PlatinumFileReader(wtaFile);
    let magic = await wta.readString(0, 4);

    if (magic !== 'WTB\0') {
        throw new Error('Invalid WTA file');
    }

    let numTextures = await wta.readUint32(8, true);
    let textureOffsetsOffset = await wta.readUint32(12, true);
    let textureSizesOffset = await wta.readUint32(16, true);
    let textureFlagsOffset = await wta.readUint32(20, true);
    let textureIdsOffset = await wta.readUint32(24, true);
    let textureInfoOffset = await wta.readUint32(28, true);

    let textures = [];
    for (let i = 0; i < numTextures; i++) {
        let offset = await wta.readUint32(textureOffsetsOffset + i * 4, true);
        let size = await wta.readUint32(textureSizesOffset + i * 4, true);
        let flags = await wta.readUint32(textureFlagsOffset + i * 4, true);
        let id = await wta.readUint32(textureIdsOffset + i * 4, true);
        //let info = await wta.readUint32(textureInfoOffset + i * 4, true);
        textures.push({
            offset,
            size,
            flags,
            id,
            //info,
            data: wtpFile.slice(offset, offset + size)
        });
    }

    let version = 3
    let paddingAmount = Math.floor((numTextures + 7) / 8) * 8 // rounds up to the nearest 8th integer
    let textureOffsetArrayOffset = 32
    let textureSizeArrayOffset = Math.ceil((textureOffsetArrayOffset + (numTextures * 4)) / 0x20) * 0x20
    let unknownArrayOffset1 = Math.ceil((textureSizeArrayOffset + (numTextures * 4)) / 0x20) * 0x20
    let textureIdentifierArrayOffset = Math.ceil((unknownArrayOffset1 + (numTextures * 4)) / 0x20) * 0x20
    let textureInfoArrayOffset = Math.ceil((textureIdentifierArrayOffset + (numTextures * 4)) / 0x20) * 0x20
    let wtaTextureIdentifier = textures.map(x => x.id)
    let unknownArray1 = new Array(numTextures).fill(1677721632) // DDS textures are always SRGB
    let textureInfoArray = []
    let textureImageBuffers: ArrayBuffer[] = []

    for (const texture of textures) {
        let reader = new PlatinumFileReader(texture.data)

        let textureInfo = {
            magic: ".tex",
            format: 0x7D,
            width: await reader.readUint32(12, true),
            height: await reader.readUint32(16, true),
            depth: 1,
            mipCount: 1,
            type: 1,
            blockHeightLog2: 4,
            arrayCount: 1
        }

        let dxt = await reader.readString(84, 88)

        switch (dxt) {
            case 'DXT1':
                textureInfo.format = 0x46 // BC1_UNORM_SRGB
                break
            case 'DXT3':
                textureInfo.format = 0x47 // BC2_UNORM_SRGB
                break
            case 'DXT5':
                textureInfo.format = 0x48 // BC3_UNORM_SRGB
                break
            default:
                textureInfo.format = 0x50 // BC6H_UF16
        }

        if (textureInfo.height < 256) {
            textureInfo.blockHeightLog2 = 8 & 7
        }
        if (textureInfo.height < 128) {
            textureInfo.blockHeightLog2 = 16 & 7
        }

        let imageData = texture.data.slice(0x80);
        let buffer = compressImageData(
            formats[textureInfo.format as never],
            textureInfo.width,
            textureInfo.height,
            textureInfo.depth,
            textureInfo.arrayCount,
            textureInfo.mipCount,
            imageData,
            textureInfo.blockHeightLog2
        )

        if (!(buffer instanceof ArrayBuffer)) {
            throw new Error('Failed to compress image data');
        }

        if (buffer.byteLength < 90112) {
            let newBuf = new ArrayBuffer(90112)
            new Uint8Array(newBuf).set(new Uint8Array(buffer))
            buffer = newBuf
        }

        let padding = new ArrayBuffer(16 - buffer.byteLength % 16)
        buffer = concatArrayBuffer(buffer, padding)

        textureInfoArray.push(textureInfo)
        textureImageBuffers.push(buffer)
    }

    let header = new ArrayBuffer(textureInfoArrayOffset)
    let headerView = new DataView(header)
    headerView.setUint32(0, 4346967, true) // "WTB\x00"
    headerView.setUint32(4, version, true)
    headerView.setUint32(8, numTextures, true)
    headerView.setUint32(12, textureOffsetArrayOffset, true)
    headerView.setUint32(16, textureSizeArrayOffset, true)
    headerView.setUint32(20, unknownArrayOffset1, true)
    headerView.setUint32(24, textureIdentifierArrayOffset, true)
    headerView.setUint32(28, textureInfoArrayOffset, true)

    let wtaTextureOffset: number[] = []
    let wtaTextureSize: number[] = []

    let offset = 0;
    for (let i = 0; i < numTextures; i++) {
        wtaTextureOffset.push(offset)
        wtaTextureSize.push(textureImageBuffers[i].byteLength)
        offset += textureImageBuffers[i].byteLength;
    }

    for (let i = 0; i < numTextures; i++) {
        headerView.setUint32(textureOffsetArrayOffset + (i * 4), wtaTextureOffset[i], true)
        headerView.setUint32(textureSizeArrayOffset + (i * 4), wtaTextureSize[i], true)
        headerView.setUint32(unknownArrayOffset1 + (i * 4), unknownArray1[i], true)
        headerView.setUint32(textureIdentifierArrayOffset + (i * 4), wtaTextureIdentifier[i], true)
    }

    let infos = new ArrayBuffer(numTextures * 0x100)
    let infosView = new DataView(infos)

    for (let i = 0; i < numTextures; i++) {
        let info = textureInfoArray[i]
        infosView.setUint32(i * 0x100, 2019914798, true) // ".tex"
        infosView.setUint32(i * 0x100 + 4, info.format, true)
        infosView.setUint32(i * 0x100 + 8, 1, true) // texture type (1)
        infosView.setUint32(i * 0x100 + 12, info.width, true)
        infosView.setUint32(i * 0x100 + 16, info.height, true)
        infosView.setUint32(i * 0x100 + 20, info.depth, true)
        infosView.setUint32(i * 0x100 + 24, info.mipCount, true)
        infosView.setUint32(i * 0x100 + 28, 256, true) // header size? (0x100 = 256)
        infosView.setUint32(i * 0x100 + 32, wtaTextureSize[i], true)
    }

    let paddingBuffer = new ArrayBuffer(16 - header.byteLength + infos.byteLength + paddingAmount % 16)

    return [concatArrayBuffer(header, infos, paddingBuffer), concatArrayBuffer(...textureImageBuffers)]
}

export default async function convert(wtaFile: ArrayBuffer, wtpFile: ArrayBuffer): Promise<[ArrayBuffer, ArrayBuffer]> {
    let wta = new PlatinumFileReader(wtaFile);
    let magic = await wta.readString(0, 4);

    if (magic !== 'WTB\0') {
        throw new Error('Invalid WTA file');
    }

    let numTextures = await wta.readUint32(8, true);
    let textureOffsetsOffset = await wta.readUint32(12, true);
    let textureSizesOffset = await wta.readUint32(16, true);
    let textureInfoOffset = await wta.readUint32(28, true);

    let textureDatas = [];

    for (let i = 0; i < numTextures; i++) {
        let offset = await wta.readUint32(textureOffsetsOffset + i * 4, true);
        let size = await wta.readUint32(textureSizesOffset + i * 4, true);
        //let info = await wta.readUint32(textureInfoOffset + i * 4, true);
        textureDatas.push(wtpFile.slice(offset, offset + size));
    }

    let textureInfoArray = []
    let textureImageBuffers: ArrayBuffer[] = []

    let sizes = []

    for (const texture of textureDatas) {
        let reader = new PlatinumFileReader(texture)

        let textureInfo = {
            magic: ".tex",
            format: 0x7D,
            width: await reader.readUint32(12, true),
            height: await reader.readUint32(16, true),
            depth: 1,
            mipCount: 1,
            type: 1,
            blockHeightLog2: 4,
            arrayCount: 1
        }

        let magic = await reader.readString(0, 4)
        if (magic !== 'DDS ') {
            throw new Error('Invalid DDS file ' + magic);
        }

        let dxt = await reader.readString(84, 88)

        switch (dxt) {
            case 'DXT1':
                textureInfo.format = 0x46 // BC1_UNORM_SRGB
                break
            case 'DXT3':
                textureInfo.format = 0x47 // BC2_UNORM_SRGB
                break
            case 'DXT5':
                textureInfo.format = 0x48 // BC3_UNORM_SRGB
                break
            default:
                textureInfo.format = 0x50 // BC6H_UF16
        }

        if (textureInfo.height < 256) {
            textureInfo.blockHeightLog2 = 8 & 7
        }
        if (textureInfo.height < 128) {
            textureInfo.blockHeightLog2 = 16 & 7
        }

        let imageData = texture.slice(0x80);
        let buffer = compressImageData(
            formats[textureInfo.format as never],
            textureInfo.width,
            textureInfo.height,
            textureInfo.depth,
            textureInfo.arrayCount,
            textureInfo.mipCount,
            imageData,
            textureInfo.blockHeightLog2
        )

        if (!(buffer instanceof ArrayBuffer)) {
            throw new Error('Failed to compress image data');
        }

        if (buffer.byteLength < 90112) {
            let newBuf = new ArrayBuffer(90112)
            new Uint8Array(newBuf).set(new Uint8Array(buffer))
            buffer = newBuf
        }
        sizes.push(buffer.byteLength)

        let padding = new ArrayBuffer(16 - buffer.byteLength % 16)
        buffer = concatArrayBuffer(buffer, padding)

        textureInfoArray.push(textureInfo)
        textureImageBuffers.push(buffer)
    }

    // textureInfoOffset can be 0; if it is, just load the whole file
    let upToInfos = wtaFile.slice(0, textureInfoOffset || undefined)
    let upToInfosView = new DataView(upToInfos)

    if (textureInfoOffset === 0) {
        // set it to the end of the file
        upToInfosView.setUint32(28, wtaFile.byteLength, true)
    }

    let offset = 0;
    for (let i = 0; i < numTextures; i++) {
        upToInfosView.setUint32(textureOffsetsOffset + (i * 4), offset, true)
        upToInfosView.setUint32(textureSizesOffset + (i * 4), sizes[i], true)

        offset += textureImageBuffers[i].byteLength;
    }

    let infos = new ArrayBuffer(numTextures * 0x100)
    let infosView = new DataView(infos)

    for (let i = 0; i < numTextures; i++) {
        let info = textureInfoArray[i]
        infosView.setUint32(i * 0x100, 2019914798, true) // ".tex"
        infosView.setUint32(i * 0x100 + 4, info.format, true)
        infosView.setUint32(i * 0x100 + 8, 1, true) // texture type (1)
        infosView.setUint32(i * 0x100 + 12, info.width, true)
        infosView.setUint32(i * 0x100 + 16, info.height, true)
        infosView.setUint32(i * 0x100 + 20, info.depth, true)
        infosView.setUint32(i * 0x100 + 24, info.mipCount, true)
        infosView.setUint32(i * 0x100 + 28, 256, true) // header size? (0x100 = 256)
        infosView.setUint32(i * 0x100 + 32, sizes[i], true)
    }

    let paddingBuffer = new ArrayBuffer(16 - ((upToInfos.byteLength + infos.byteLength) % 16))

    return [concatArrayBuffer(upToInfos, infos, paddingBuffer), concatArrayBuffer(...textureImageBuffers)]
}