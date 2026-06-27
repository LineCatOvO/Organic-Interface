#!/usr/bin/env node
import { createCLI } from './cli/CLI.js';

const cli = createCLI({
  name: 'organic-interface',
  version: '0.1.0',
  description: 'Organic Interface CLI',
});

const args = process.argv.slice(2);

cli.run(args).then((result) => {
  if (result.message) console.log(result.message);
  if (result.error) console.error(result.error);
  process.exit(result.code);
});