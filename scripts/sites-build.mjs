import{mkdir,copyFile,writeFile}from'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js',`export default {async fetch(request,env){const url=new URL(request.url);const assetUrl=new URL(url);if(url.pathname==='/')assetUrl.pathname='/index.html';let response=await env.ASSETS.fetch(new Request(assetUrl,request));if(response.status===404&&!url.pathname.includes('.')){assetUrl.pathname='/index.html';response=await env.ASSETS.fetch(new Request(assetUrl,request));}return response;}};`);
