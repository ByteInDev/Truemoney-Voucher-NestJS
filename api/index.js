/*
 * Vercel serverless entrypoint (Node runtime).
 *
 * Bootstraps the NestJS application once per function instance and then
 * hands every request to the underlying Express adapter. Requires a build
 * first: `npm run build` compiles src -> dist (vercel.json also runs it
 * during deployment).
 *
 * Note for Vercel: the cycletls transport spawns a bundled Go binary per
 * function instance (cold start). If the platform blocks child processes,
 * fall back to the Docker image.
 */
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { configureApp } = require('../dist/configure-app');

let cachedExpress;

async function bootstrap() {
  if (!cachedExpress) {
    const app = await NestFactory.create(AppModule);
    configureApp(app);
    await app.init();
    cachedExpress = app.getHttpAdapter().getInstance();
  }
  return cachedExpress;
}

module.exports = async function handler(req, res) {
  const express = await bootstrap();
  return express(req, res);
};