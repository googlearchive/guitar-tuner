# Guitar Tuner

![Guitar Tuner](https://aerotwist.com/static/blog/guitar-tuner/grabs.png)

A sample web app that lets you tune a guitar. It uses ES6 classes (via Babel) and [Polymer 1.0](https://www.polymer-project.org/1.0/).

[See the site here](https://guitar-tuner.appspot.com/)

## Running the site locally

1. Download the [Google App Engine SDK for Python](https://cloud.google.com/appengine/downloads?hl=en). Grab the Launcher, and install it.
2. `npm install -g gulp`
3. `git clone https://github.com/GoogleChrome/guitar-tuner`
4. `cd guitar-tuner`
5. `npm i`
6. `gulp`

If you get an error about lib-sass, you will need to get a newer version of gulp-sass:

```bash
throw new Error('`libsass` bindings not found. Try reinstalling `node-sass`?');
```

The error is thrown if your version of Node is newer than 0.12 or so.

1. Open `package.json` and change the gulp-sass version to 2.1.0 or newer, i.e. "gulp-sass": "^2.1.0"
2. `rm -rf node_modules/`
3. `npm i`
4. `gulp`

Once the build has finished, you can boot the GAE Launcher and choose File -> Add Existing Application... and point it at the guitar-tuner folder.

Start the application, and visit the URL indicated by the port, i.e. [http://localhost:8080](http://localhost:8080) (N.B. you do not the admin port).

## License

Copyright 2015 Google, Inc.

Licensed to the Apache Software Foundation (ASF) under one or more contributor license agreements. See the NOTICE file distributed with this work for additional information regarding copyright ownership. The ASF licenses this file to you under the Apache License, Version 2.0 (the “License”); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an “AS IS” BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Please note: this is not a Google product
