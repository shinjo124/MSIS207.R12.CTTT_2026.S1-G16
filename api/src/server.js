import 'dotenv/config';

const { default: app } = await import('./app.js');

const port = Number(process.env.PORT || 4000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Tripo API listening on port ${port}`);
});
