import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const input='public/posters',output='public/thumbs';
await fs.mkdir(output,{recursive:true});
for(const file of await fs.readdir(input)) {
 if(!/\.(jpe?g|png|webp)$/i.test(file))continue;
 await sharp(path.join(input,file)).rotate().resize({width:168,height:252,fit:'inside',withoutEnlargement:true}).webp({quality:75}).toFile(path.join(output,path.parse(file).name+'.webp'));
}
console.log('Local poster thumbnails ready (168×252 max, WebP)');
