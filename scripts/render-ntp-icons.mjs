import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const icon=await readFile(new URL('../public/icons/ntp-icon.svg',import.meta.url),'utf8');
for(const [file,size] of [['public/icons/ntp-icon-192.png',192],['public/icons/ntp-icon-512.png',512],['public/icons/ntp-apple-touch-icon.png',180],['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',1024]]){
 await sharp(Buffer.from(icon)).resize(size,size).flatten({background:'#101b2b'}).png({compressionLevel:9}).toFile(file);
}
const foreground=icon.replace(/<rect[^>]*\/>/,'').replace('<path fill=','<path transform="translate(64 64) scale(.75)" fill=');
for(const [density,size] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){
 const dir=`android/app/src/main/res/mipmap-${density}`;
 for(const name of ['ic_launcher.png','ic_launcher_round.png'])await sharp(Buffer.from(icon)).resize(size,size).png({compressionLevel:9}).toFile(`${dir}/${name}`);
 await sharp(Buffer.from(foreground)).resize(Math.round(size*2.25),Math.round(size*2.25)).png({compressionLevel:9}).toFile(`${dir}/ic_launcher_foreground.png`);
}
