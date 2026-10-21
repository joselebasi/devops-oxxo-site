import clerk from '@clerk/astro';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [clerk({
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    signInFallbackRedirectUrl: '/',
    signUpFallbackRedirectUrl: '/',
  }), react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
