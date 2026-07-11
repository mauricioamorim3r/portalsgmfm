import{mkdir,copyFile,writeFile}from'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js',`export default {async fetch(request,env){return env.ASSETS.fetch(request)}};`);
