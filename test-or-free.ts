import https from 'https';

const options = {
  hostname: 'openrouter.ai',
  port: 443,
  path: '/api/v1/models',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const m = json.data.find((m: any) => m.id === 'deepseek/deepseek-r1:free');
      console.log('Is free R1 available?', m !== undefined);
      const freeModels = json.data.filter((m: any) => m.id.endsWith(':free') && m.id.includes('deepseek'));
      console.log('Free deepseek models:', freeModels.map((m: any) => m.id));
    } catch (e) {
      console.log(e);
    }
  });
});

req.end();
