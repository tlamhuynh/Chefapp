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
      const deepseekModels = json.data.filter((m: any) => m.id.toLowerCase().includes('deepseek'));
      console.log('OpenRouter DeepSeek Models:', deepseekModels.map((m: any) => m.id));
    } catch (e) {
      console.log(e);
    }
  });
});

req.end();
