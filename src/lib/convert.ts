import { unzipSync, zipSync } from 'fflate'
import extractDAT from './filetypes/DAT/extract'
import repackDAT from './filetypes/DAT/repack'
import convertWTA from './filetypes/WTA/convert';
import PlatinumFileReader from './filetypes/PlatinumFileReader';

// Takes in a ZIP file and returns a converted zip file
async function convert(file: File): Promise<ArrayBuffer> {
    let files = unzipSync(new Uint8Array(await file.arrayBuffer()));


    for (let key of Object.keys(files).filter(x => x.endsWith('.dat'))) {
        let dat = files[key];
        let dtt = files[key.replace('.dat', '.dtt')];

        // TODO: support WTB
        if (dtt === undefined) continue;

        // unzip DAT
        let datFiles = (await extractDAT(new PlatinumFileReader(dat.buffer))).files;
        let dttFiles = (await extractDAT(new PlatinumFileReader(dtt.buffer))).files;

        for (let wta of datFiles) {
            if (wta.name.endsWith('.wta')) {
                let filename = wta.name.replace('.wta', '.wtp');
                let wtp = dttFiles.find(x => x.name === filename);
                if (wtp === undefined) throw new Error('Missing WTP file');

                console.log(`Converting ${wta.name} (${wta.arrayBuffer.byteLength}b), ${wtp.name} (${wtp.arrayBuffer.byteLength}b) - ${key}`);
                
                let forceASTC = false;
                if (key.includes('ui/') || key.includes('font/')) {
                    forceASTC = true;
                    console.log("Forcing ASTC");
                }
                
                const [wtaArrayBuffer, wtpArrayBuffer] = await convertWTA(wta.arrayBuffer, wtp.arrayBuffer, forceASTC);
                wta.arrayBuffer = wtaArrayBuffer;
                wtp.arrayBuffer = wtpArrayBuffer;
                console.log("Convert success");
            }
        }

        // repack DATs
        let newDat = await repackDAT({ files: datFiles });
        let newDtt = await repackDAT({ files: dttFiles });

        files[key] = new Uint8Array(newDat);
        files[key.replace('.dat', '.dtt')] = new Uint8Array(newDtt);
    }

    // detect data folder and change it if possible
    let keys = Object.keys(files);
    for (let key of keys) {
        if (key.includes('/data/')) {
            let newKey = key.replace('/data/', '/romfs/');
            files[newKey] = files[key];
            delete files[key];
        } else if (key.startsWith('data/')) {
            let newKey = key.replace('data/', 'romfs/');
            files[newKey] = files[key];
            delete files[key];
        }
    }

    return zipSync(files).buffer;
}


export default convert;