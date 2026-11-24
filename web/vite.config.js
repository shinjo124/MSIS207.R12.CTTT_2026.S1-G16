import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use Vite's React plugin for JSX transforms and component refresh during development.
export default defineConfig({
  plugins: [react()],
});
