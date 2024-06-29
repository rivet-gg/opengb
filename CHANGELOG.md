# Changelog

## [1.0.0](https://github.com/rivet-gg/opengb/compare/v0.1.5...v1.0.0) (2024-06-29)


### ⚠ BREAKING CHANGES

* **runtime:** rename `ModuleContext.userConfig` -> `ModuleContext.config` ([#397](https://github.com/rivet-gg/opengb/issues/397))

### Features

* add coming soon module status ([#422](https://github.com/rivet-gg/opengb/issues/422)) ([1e00a5b](https://github.com/rivet-gg/opengb/commit/1e00a5ba24a4932b59d2fc25b06d83399549859a))


### Bug Fixes

* **actor:** fix varargs for ActorProxy ([#392](https://github.com/rivet-gg/opengb/issues/392)) ([83757fc](https://github.com/rivet-gg/opengb/commit/83757fc93520c14b5aec620d0f4b73538a7967db))
* dont generate openapi spec for private scripts ([#396](https://github.com/rivet-gg/opengb/issues/396)) ([fc9f186](https://github.com/rivet-gg/opengb/commit/fc9f186ac749b7767b143d0e9dcba018415bac7a))
* **migrate:** force install prisma as fallback ([#389](https://github.com/rivet-gg/opengb/issues/389)) ([0c4e4ed](https://github.com/rivet-gg/opengb/commit/0c4e4edd603158f9358bb1158df4f9b673f9dc3e))
* one db per env ([#395](https://github.com/rivet-gg/opengb/issues/395)) ([6e51eb5](https://github.com/rivet-gg/opengb/commit/6e51eb513094918a2bd7450d68cfe51e1ae91e8c))
* **runtime:** log error message instead of returning in error ([#412](https://github.com/rivet-gg/opengb/issues/412)) ([39f64fe](https://github.com/rivet-gg/opengb/commit/39f64fe67f26d86ab3e857c761fcae595690b472))
* **runtime:** prevent cross-request resource sharing for pg pools ([#403](https://github.com/rivet-gg/opengb/issues/403)) ([cd31b76](https://github.com/rivet-gg/opengb/commit/cd31b763ef18ceec7c3d8a7cd7faffc30683734f))
* **runtime:** switch to prisma ws to support transactions ([#393](https://github.com/rivet-gg/opengb/issues/393)) ([353fcb9](https://github.com/rivet-gg/opengb/commit/353fcb962b301422aee22dc1bab2c6b08f592550))
* set search path in db sh ([#406](https://github.com/rivet-gg/opengb/issues/406)) ([aaf11f1](https://github.com/rivet-gg/opengb/commit/aaf11f105229778127c8dcb889c87e899c84f78b))
* specify search path correctly for pg pool ([#405](https://github.com/rivet-gg/opengb/issues/405)) ([5b22806](https://github.com/rivet-gg/opengb/commit/5b22806192cb570f677ffa631092922ce2759033))
* updat esbuild support for cloudflare hyperdrive ([#413](https://github.com/rivet-gg/opengb/issues/413)) ([54a5331](https://github.com/rivet-gg/opengb/commit/54a5331eab1261621a9e37d410c61c6b162fe6af))
* use schemas instead of dbs ([#400](https://github.com/rivet-gg/opengb/issues/400)) ([0863b7a](https://github.com/rivet-gg/opengb/commit/0863b7a3bd4b0cd95309c0cfdc80fb2185f25fcd))


### Documentation

* add wide mode on intro ([#387](https://github.com/rivet-gg/opengb/issues/387)) ([e213daf](https://github.com/rivet-gg/opengb/commit/e213daf779f520364bd560893ec6cef0fe5ff077))
* improve comparison ([#384](https://github.com/rivet-gg/opengb/issues/384)) ([5d39eff](https://github.com/rivet-gg/opengb/commit/5d39eff797c45d6c18439a7479a866ff4ab49ef1))
* raw sql queries ([#415](https://github.com/rivet-gg/opengb/issues/415)) ([722e814](https://github.com/rivet-gg/opengb/commit/722e8145991e43d01499fc5a0dee7d244162431f))
* split up public & internal scripts for clarity ([#399](https://github.com/rivet-gg/opengb/issues/399)) ([5fdbed8](https://github.com/rivet-gg/opengb/commit/5fdbed8aafa551fa6c3070aad6d032af86b37e45))


### Code Refactoring

* move from pool-per-module to singleton pool with PgAdapter-per-module ([#411](https://github.com/rivet-gg/opengb/issues/411)) ([5347475](https://github.com/rivet-gg/opengb/commit/5347475d74a7b3c34ad12ce8ffe6be0eaa2baa1c))


### Chores

* add `defaultConfig` to `module.json` so users can pass partial configs ([#398](https://github.com/rivet-gg/opengb/issues/398)) ([7373176](https://github.com/rivet-gg/opengb/commit/73731764b86f1ca13fed7396c2e3e08549eec501))
* add coming soon modules to docs ([#423](https://github.com/rivet-gg/opengb/issues/423)) ([059809d](https://github.com/rivet-gg/opengb/commit/059809d29c00e366f45c3c522efcb7f3a0d1660e))
* bump docs ([#408](https://github.com/rivet-gg/opengb/issues/408)) ([b14c32a](https://github.com/rivet-gg/opengb/commit/b14c32aa8439cf15e0f5e671d7f5205e5b6dc2d0))
* fix groups typo ([b57c5d2](https://github.com/rivet-gg/opengb/commit/b57c5d255bab4c4813d2ca5f08b98ebfafd10ddd))
* fix lints ([#407](https://github.com/rivet-gg/opengb/issues/407)) ([b7b3b4d](https://github.com/rivet-gg/opengb/commit/b7b3b4dd92b757ba6a604d38e375798e293e686d))
* log internal errors ([#382](https://github.com/rivet-gg/opengb/issues/382)) ([e427dd5](https://github.com/rivet-gg/opengb/commit/e427dd54aa3b15b6c3dd0743c80da4e1f4cc22dd))
* **runtime:** rename `ModuleContext.userConfig` -&gt; `ModuleContext.config` ([#397](https://github.com/rivet-gg/opengb/issues/397)) ([80bf5ac](https://github.com/rivet-gg/opengb/commit/80bf5ac2c9e5cb13878754113454543476f1f9a9))
* typo ([#383](https://github.com/rivet-gg/opengb/issues/383)) ([7fa2410](https://github.com/rivet-gg/opengb/commit/7fa241098fbfbbad75aff12b2de09a2dff131cd7))
* typo ([#386](https://github.com/rivet-gg/opengb/issues/386)) ([f1a73af](https://github.com/rivet-gg/opengb/commit/f1a73afb4a3d63034510c229ccf9a28dc8d4a893))
* update ph token ([9a06d0a](https://github.com/rivet-gg/opengb/commit/9a06d0a25de68c4f1da4b461aeb4fb40ad2bc62b))
* update types in actor files ([#414](https://github.com/rivet-gg/opengb/issues/414)) ([f464e86](https://github.com/rivet-gg/opengb/commit/f464e86b3b29fa52da7bc86217f61965b365efef))

## [0.1.5](https://github.com/rivet-gg/opengb/compare/v0.1.4...v0.1.5) (2024-06-11)


### Continuous Integration

* update default permissions for release-please ([#378](https://github.com/rivet-gg/opengb/issues/378)) ([564cdfe](https://github.com/rivet-gg/opengb/commit/564cdfed7a9508a2716529f4621366b6a432839e))

## [0.1.4](https://github.com/rivet-gg/opengb/compare/v0.1.3...v0.1.4) (2024-06-11)


### Continuous Integration

* fix outputs fro release-please ([#376](https://github.com/rivet-gg/opengb/issues/376)) ([780c6b6](https://github.com/rivet-gg/opengb/commit/780c6b6c03a8be8e3cbae9a9feb105128ca57eb7))

## [0.1.3](https://github.com/rivet-gg/opengb/compare/v0.1.2...v0.1.3) (2024-06-11)


### Bug Fixes

* abort when trying to run docker commands inside of docker ([#372](https://github.com/rivet-gg/opengb/issues/372)) ([8a66aee](https://github.com/rivet-gg/opengb/commit/8a66aee355e075a8666a1f5c1df039f86ebb326f))
* don't run docker commands when already inside docker ([#368](https://github.com/rivet-gg/opengb/issues/368)) ([738dc2b](https://github.com/rivet-gg/opengb/commit/738dc2b38e141eee1c73657805b24a05afb48a59))
* explicitly handle SIGINT ([#371](https://github.com/rivet-gg/opengb/issues/371)) ([b4c6039](https://github.com/rivet-gg/opengb/commit/b4c6039acbb73e5feefae739ccbf0926f9386b1c))
* run esbuild deno plugin as portable ([#373](https://github.com/rivet-gg/opengb/issues/373)) ([7de9fce](https://github.com/rivet-gg/opengb/commit/7de9fceb335bd9836febf983652bde52188d5b52))


### Documentation

* regs & deps ([#369](https://github.com/rivet-gg/opengb/issues/369)) ([b18f666](https://github.com/rivet-gg/opengb/commit/b18f6667d4519402b67202e6494193d0c50eae0c))


### Continuous Integration

* docker build push inline in release please workflow ([#364](https://github.com/rivet-gg/opengb/issues/364)) ([1e2e21c](https://github.com/rivet-gg/opengb/commit/1e2e21cef078bed9a509b289232759136cd0d6f2))


### Chores

* rename build format cf -&gt; cloudflare-workers ([#370](https://github.com/rivet-gg/opengb/issues/370)) ([80a2ebb](https://github.com/rivet-gg/opengb/commit/80a2ebb7988923d75b2486a2d301040fb37de41d))

## [0.1.2](https://github.com/rivet-gg/opengb/compare/v0.1.1...v0.1.2) (2024-06-10)


### Continuous Integration

* build push cli.Dockerfile ([#362](https://github.com/rivet-gg/opengb/issues/362)) ([a66f030](https://github.com/rivet-gg/opengb/commit/a66f030420a005c48ea9d43f1e3f99cb5e35921f))

## [0.1.1](https://github.com/rivet-gg/opengb/compare/v0.1.0...v0.1.1) (2024-06-10)


### Bug Fixes

* undefined user config now defaults to empty object ([#358](https://github.com/rivet-gg/opengb/issues/358)) ([ec5c576](https://github.com/rivet-gg/opengb/commit/ec5c57656b562020d2bd077a06dd36d736fb454a))


### Chores

* bump registry ([#357](https://github.com/rivet-gg/opengb/issues/357)) ([c8af1a8](https://github.com/rivet-gg/opengb/commit/c8af1a84292c354a7683a22d29667c68c30242b7))
* update default port ([#360](https://github.com/rivet-gg/opengb/issues/360)) ([35fd6d8](https://github.com/rivet-gg/opengb/commit/35fd6d8df62f44279b79b07fd6c0f8666aa1b9fd))

## [0.1.0](https://github.com/rivet-gg/opengb/compare/v1.0.0...v0.1.0) (2024-06-10)


### ⚠ BREAKING CHANGES

* **gen:** Fix misc generated files and imports ([#142](https://github.com/rivet-gg/opengb/issues/142))
* **gen:** Fix misc generated files and imports
* **db:** Fix default postgres login password ([#141](https://github.com/rivet-gg/opengb/issues/141))
* **db:** Fix default postgres login password
* Require modules to specify dependencies in `module.yaml`
* Require modules to specify dependencies in `module.yaml`

### Features

* add cli:run:dirty script ([#185](https://github.com/rivet-gg/opengb/issues/185)) ([8d238c1](https://github.com/rivet-gg/opengb/commit/8d238c1ec46109733a3f1770a76d27ef0d077af4))
* add default registry ([899a21c](https://github.com/rivet-gg/opengb/commit/899a21cf7e898438567031cf6c1e0534c1056cd0))
* add default registry ([#153](https://github.com/rivet-gg/opengb/issues/153)) ([592a572](https://github.com/rivet-gg/opengb/commit/592a572b836bfdf5e306c92dfcd8f5e89164f7d3))
* add durable storage MVP ([#267](https://github.com/rivet-gg/opengb/issues/267)) ([7d2d7be](https://github.com/rivet-gg/opengb/commit/7d2d7bea535dafb13560e1aedb172c02e9c436dc))
* add env flag for rivet cli ([8b1b100](https://github.com/rivet-gg/opengb/commit/8b1b1006df00a601d0aaa1fb098a72870c522c34))
* add env flag for rivet cli ([#243](https://github.com/rivet-gg/opengb/issues/243)) ([64c7c47](https://github.com/rivet-gg/opengb/commit/64c7c47724466c3caa4c7973772c9b4b5a33e1fc))
* add format & lint tasks ([ec2a3c6](https://github.com/rivet-gg/opengb/commit/ec2a3c67c76d26c9479035f61ed2793af2cda836))
* add lint & format commands ([0485af5](https://github.com/rivet-gg/opengb/commit/0485af55a36625caa09fa86f79fec8f3c98fcb39))
* add lint & format commands ([#128](https://github.com/rivet-gg/opengb/issues/128)) ([df4ff29](https://github.com/rivet-gg/opengb/commit/df4ff295bd9ad72d6c3197ff9ccb343c6639edd3))
* add module regsitries ([#68](https://github.com/rivet-gg/opengb/issues/68)) ([4e9a875](https://github.com/rivet-gg/opengb/commit/4e9a875dad7b122d62b775d4603cc0e6e742ac2b))
* add sh and url db commands ([0186bc1](https://github.com/rivet-gg/opengb/commit/0186bc1f8d378d05e54f08a1eee029c20b979089))
* add sh and url db commands ([#244](https://github.com/rivet-gg/opengb/issues/244)) ([64a53e1](https://github.com/rivet-gg/opengb/commit/64a53e1e4f7e9fff29646ae32bd87b7fbf001e1b))
* allow toggling force deploy migrations ([#228](https://github.com/rivet-gg/opengb/issues/228)) ([d6d1605](https://github.com/rivet-gg/opengb/commit/d6d1605fdb2de9fb066eb535fa0c8d264dc7b84f))
* allow toggling strict schemas ([e7de383](https://github.com/rivet-gg/opengb/commit/e7de383dd222df9765394048bfc3ba3d820c34e6))
* allow toggling strict schemas ([#227](https://github.com/rivet-gg/opengb/issues/227)) ([eebdee0](https://github.com/rivet-gg/opengb/commit/eebdee0cb5bf2028ae6f6fd519a4419111eb1ebd))
* auto-create postgres container ([a564fea](https://github.com/rivet-gg/opengb/commit/a564fead4402c5b0a6bb93148b2abc6cf2d999b2))
* auto-create postgres container ([#113](https://github.com/rivet-gg/opengb/issues/113)) ([a87da57](https://github.com/rivet-gg/opengb/commit/a87da574d5fdc64c4a698ee6cf23a46949d9c151))
* auto-generate config.ts ([#178](https://github.com/rivet-gg/opengb/issues/178)) ([8e952a2](https://github.com/rivet-gg/opengb/commit/8e952a28d21947f6d7006737c1b256b03966890c))
* Bind `modules/&lt;dep_name&gt;/public.ts` to `Module.<depName>` ([#265](https://github.com/rivet-gg/opengb/issues/265)) ([de289ad](https://github.com/rivet-gg/opengb/commit/de289ad618da171e7110af1df9e92c86eb4522e5))
* clean build output ([#189](https://github.com/rivet-gg/opengb/issues/189)) ([9f2d251](https://github.com/rivet-gg/opengb/commit/9f2d251f8c1aea1c0996bbd9e31ac28d0d46e971))
* clean command ([c923af1](https://github.com/rivet-gg/opengb/commit/c923af1f323ebb1739c16221312c6c0ef7522111))
* clean command ([#155](https://github.com/rivet-gg/opengb/issues/155)) ([2b0f9bf](https://github.com/rivet-gg/opengb/commit/2b0f9bff97091490a65e8c9d0561309a5bf8f247))
* compile module schema ([1982f57](https://github.com/rivet-gg/opengb/commit/1982f57e92d23bc787cc7ff53059f750f43e3eef))
* compile module schema ([#172](https://github.com/rivet-gg/opengb/issues/172)) ([cbf0397](https://github.com/rivet-gg/opengb/commit/cbf0397ebd90ff3e15ddefc02752478f608249b7))
* convert `ctx.modules` proxy to camelCase ([d90263a](https://github.com/rivet-gg/opengb/commit/d90263a5c487912150fa243cf4d623a67c2caecf))
* convert `ctx.modules` proxy to camelCase ([#96](https://github.com/rivet-gg/opengb/issues/96)) ([1d458e7](https://github.com/rivet-gg/opengb/commit/1d458e70f09745c9623eff10f5dba29a2762a847))
* CORS origin configuration in `backend.yaml` ([#314](https://github.com/rivet-gg/opengb/issues/314)) ([be8e6e3](https://github.com/rivet-gg/opengb/commit/be8e6e326c127bc2d71520c6f7cccd4be6e33a91))
* delayedStart for build steps for accurate logging ([#188](https://github.com/rivet-gg/opengb/issues/188)) ([adf1a46](https://github.com/rivet-gg/opengb/commit/adf1a46bb9d078032301f42726676b749d2040fc))
* e2e ci tests ([0759fe1](https://github.com/rivet-gg/opengb/commit/0759fe184910dfbf1b8ca4ae5ed8d110cb4abc9a))
* e2e ci tests ([#135](https://github.com/rivet-gg/opengb/issues/135)) ([7ededdf](https://github.com/rivet-gg/opengb/commit/7ededdf818c8db9f870dd0d131675d635d5f03af))
* expose user config in context ([#184](https://github.com/rivet-gg/opengb/issues/184)) ([67af465](https://github.com/rivet-gg/opengb/commit/67af46523ef4e04d1d9ddb9abf90d26832be31e2))
* file hashing for reusing builds ([5033d55](https://github.com/rivet-gg/opengb/commit/5033d558badbd6dea78fb148c5fa47afb57f71e5))
* file hashing for reusing builds ([bb622bc](https://github.com/rivet-gg/opengb/commit/bb622bc3079d9a62325dd2de90b469c4db92b9d7))
* file hashing for reusing builds ([dde3ecd](https://github.com/rivet-gg/opengb/commit/dde3ecd01bf1b28d2a0cb22386584393d8aaaf3d))
* file hashing for reusing builds ([#109](https://github.com/rivet-gg/opengb/issues/109)) ([479c0ef](https://github.com/rivet-gg/opengb/commit/479c0ef92661e87d488ec3b7e5b465416090ca7b))
* filter modules to be tested ([d47f2d8](https://github.com/rivet-gg/opengb/commit/d47f2d8af2aa029dc0e0bf9c03ffab6c75997e51))
* filter modules to be tested ([#131](https://github.com/rivet-gg/opengb/issues/131)) ([aec4993](https://github.com/rivet-gg/opengb/commit/aec4993856c2f982d8c8fca47d6f35e4a0bb9f2e))
* git registries ([a078b8d](https://github.com/rivet-gg/opengb/commit/a078b8d73ea8cfd99f0c4a44569449701686ad73))
* git registries ([#123](https://github.com/rivet-gg/opengb/issues/123)) ([fcfc3bd](https://github.com/rivet-gg/opengb/commit/fcfc3bd227fb89447f95cfdc061c20d32c33b7eb))
* init command to create project ([dc84a98](https://github.com/rivet-gg/opengb/commit/dc84a98415f58072453275ce5a15aabf70022aad))
* init command to create project ([#147](https://github.com/rivet-gg/opengb/issues/147)) ([9e27e0f](https://github.com/rivet-gg/opengb/commit/9e27e0f66d427d0091a48fe1d976d0521da5ee69))
* module dependencies ([#134](https://github.com/rivet-gg/opengb/issues/134)) ([985e477](https://github.com/rivet-gg/opengb/commit/985e4773187f7108cb9b6685f4dc7f1affdcf911))
* move Prisma to run Deno-native, remove Node & Docker dependency from running, add Dockerfile ([#341](https://github.com/rivet-gg/opengb/issues/341)) ([345dc43](https://github.com/rivet-gg/opengb/commit/345dc437d1a52aa74d17d9bbd1296549d83cce61))
* move tasks to standalone cli ([#78](https://github.com/rivet-gg/opengb/issues/78)) ([b216eeb](https://github.com/rivet-gg/opengb/commit/b216eeb3802b22c64213fff5e780118496fde695))
* move tjs schema to worker ([623b4fe](https://github.com/rivet-gg/opengb/commit/623b4fe4176c84977630b7aed82d933d9e05b9af))
* move tjs schema to worker ([3ca763b](https://github.com/rivet-gg/opengb/commit/3ca763bae280b401ba8a4eadbe5c481ddf1977b5))
* move tjs schema to worker ([0469872](https://github.com/rivet-gg/opengb/commit/0469872a49679697db1bf655727ce2fd74a6c250))
* move tjs schema to worker ([#110](https://github.com/rivet-gg/opengb/issues/110)) ([3c4a564](https://github.com/rivet-gg/opengb/commit/3c4a5647ccea04099f4e656710fb4c7ecd654bc3))
* parse config.ts & validate user config ([#181](https://github.com/rivet-gg/opengb/issues/181)) ([c59de8b](https://github.com/rivet-gg/opengb/commit/c59de8b5b87025b6fe1b505f0d285358ae010cc7))
* print separator when detect watch changes ([#224](https://github.com/rivet-gg/opengb/issues/224)) ([faa78eb](https://github.com/rivet-gg/opengb/commit/faa78eb630088f590ee1e85fc5c20c8ab3b19047))
* Require modules to specify dependencies in `module.yaml` ([fc629fe](https://github.com/rivet-gg/opengb/commit/fc629fec45d949ed22a0b158b9160cf1edd753b6))
* Require modules to specify dependencies in `module.yaml` ([d027dde](https://github.com/rivet-gg/opengb/commit/d027ddea4de4df2b2c46b69eb9e7c80f0a370f24))
* run only local tests unless explicitly specifying remote module ([c646bd8](https://github.com/rivet-gg/opengb/commit/c646bd8dcff5bad398f6f64f82b41a8be05fc37b))
* run only local tests unless explicitly specifying remote module ([#133](https://github.com/rivet-gg/opengb/issues/133)) ([8ab04d4](https://github.com/rivet-gg/opengb/commit/8ab04d47ad8c9999428cdbb049c8e69dbc74e099))
* **server.ts:** temp var for HTTP 204 (awaiting OGSE-3) ([dd4e09d](https://github.com/rivet-gg/opengb/commit/dd4e09dfb689f6f7ebf81d384bbf0bf263f4157a))
* ship runtime with cli, auto-populate in _gen ([e082061](https://github.com/rivet-gg/opengb/commit/e08206191bc0f7e463909edfebaaf267a54af39c))
* ship runtime with cli, auto-populate in _gen ([#107](https://github.com/rivet-gg/opengb/issues/107)) ([6211886](https://github.com/rivet-gg/opengb/commit/621188695552883aba57010daa1c00119805140e))
* standardize & parallelize build steps ([92f6a0d](https://github.com/rivet-gg/opengb/commit/92f6a0d15fbc1074b3ead871fb5e4d61499a3d52))
* standardize & parallelize build steps ([#108](https://github.com/rivet-gg/opengb/issues/108)) ([224b78c](https://github.com/rivet-gg/opengb/commit/224b78cd9fef4a87ede714f5791f8f3ddf4169e4))
* support both https & ssh git registries ([f9a0b88](https://github.com/rivet-gg/opengb/commit/f9a0b88ce8c55f6ced976f1b64d875ef08838af3))
* support both https & ssh git registries ([#146](https://github.com/rivet-gg/opengb/issues/146)) ([c83f57d](https://github.com/rivet-gg/opengb/commit/c83f57d08246880f6bc98be4094dd583e2b53034))
* **validation:** Validate error names ([32ece46](https://github.com/rivet-gg/opengb/commit/32ece46bbe81a7c8ffed5ec3d232f5ea0d42e90d))
* **validation:** Validate error names ([#118](https://github.com/rivet-gg/opengb/issues/118)) ([7c80a16](https://github.com/rivet-gg/opengb/commit/7c80a169a22d35ef5e0173862ba00e6b82364520))
* **validation:** Validate script and module names ([639e5b4](https://github.com/rivet-gg/opengb/commit/639e5b4f6a5fad6d9b2485c10c048cc36249bd13))
* **validation:** Validate script and module names ([#117](https://github.com/rivet-gg/opengb/issues/117)) ([ed80fad](https://github.com/rivet-gg/opengb/commit/ed80fad4430d67507ee7aa5c6f9742198bc22449))


### Bug Fixes

* add back error message for validation errors ([27f5944](https://github.com/rivet-gg/opengb/commit/27f5944bfbb3b43e49d80de2fa5335598ec9e6f7))
* add back error message for validation errors ([712d1a5](https://github.com/rivet-gg/opengb/commit/712d1a526c0ef60c6cd4d3f2f0beec2253e4cba5))
* add back error message for validation errors ([#240](https://github.com/rivet-gg/opengb/issues/240)) ([f051b7e](https://github.com/rivet-gg/opengb/commit/f051b7e1997a5cb5c7f8d6a1404d625e5093d50d))
* artifact reliance for type bindings on `ctx` ([#92](https://github.com/rivet-gg/opengb/issues/92)) ([24eb4cd](https://github.com/rivet-gg/opengb/commit/24eb4cd23cb0126b6814039c27a09f0b408d89f5))
* auto-shutdown node docker container ([bda8d7f](https://github.com/rivet-gg/opengb/commit/bda8d7f39e925bf1ff0a18f76b5d8104b0ea7d52))
* auto-shutdown node docker container ([#164](https://github.com/rivet-gg/opengb/issues/164)) ([f30e8f5](https://github.com/rivet-gg/opengb/commit/f30e8f5c9829c017deaa319e29449e10fa88971b))
* **build:** broken dependencyCaseConversion import ([#281](https://github.com/rivet-gg/opengb/issues/281)) ([f8f541d](https://github.com/rivet-gg/opengb/commit/f8f541d1bc2d45ffbdf259221a4598ccc121415d))
* **build:** Recover from unreadable or unparsable cache file instead of crashing ([#211](https://github.com/rivet-gg/opengb/issues/211)) ([a85b168](https://github.com/rivet-gg/opengb/commit/a85b1684c6816e9f7e74cd203f6460cbda255492))
* **build:** update .d.ts import for primsa's wasm.js for TypeScript 5.4 compatability ([#282](https://github.com/rivet-gg/opengb/issues/282)) ([9b3772e](https://github.com/rivet-gg/opengb/commit/9b3772e6f2e67d07dcaf48dfea7be9daa4cd0f49))
* bundle output with wasm ([c34d210](https://github.com/rivet-gg/opengb/commit/c34d210b51876460e50c69a33ad272c4bf00f19b))
* bundle output with wasm ([4d5b649](https://github.com/rivet-gg/opengb/commit/4d5b64907cddfdbd15b121fa7f17ccaa9a46fcd1))
* bundle paths ([593f1f4](https://github.com/rivet-gg/opengb/commit/593f1f42f0bf65c806ce5cb4a34c44f6b9a6329d))
* bundle paths ([#249](https://github.com/rivet-gg/opengb/issues/249)) ([c73e965](https://github.com/rivet-gg/opengb/commit/c73e965d47a334679bcbfcbcae1a8e71ba5d4b44))
* **CI:** E2E tests now generate the `_gen/prisma` folder. ([0c24fec](https://github.com/rivet-gg/opengb/commit/0c24fec58dcb4f629ad8674034e99776648c4815))
* **CI:** Get E2E fully working ([#143](https://github.com/rivet-gg/opengb/issues/143)) ([9950b74](https://github.com/rivet-gg/opengb/commit/9950b74d0a905914927e1f91d2f3c51729333fad))
* **ci:** sporadic postgres connection error ([#201](https://github.com/rivet-gg/opengb/issues/201)) ([7996905](https://github.com/rivet-gg/opengb/commit/7996905713ce14587fc544785af4f4db2120b81c))
* clean local module _gen ([#199](https://github.com/rivet-gg/opengb/issues/199)) ([d9f25a0](https://github.com/rivet-gg/opengb/commit/d9f25a05b831d8a4f552e2c155450f4883bc3cdb))
* **codegen:** missing quote in import ([#278](https://github.com/rivet-gg/opengb/issues/278)) ([942f7cf](https://github.com/rivet-gg/opengb/commit/942f7cf0a51c68494ebf755d4d6bd4fa16850a11))
* correct generated pg import path ([d41ff50](https://github.com/rivet-gg/opengb/commit/d41ff50c44d5be870acfed325546981ebae07180))
* correct generated pg import path ([#89](https://github.com/rivet-gg/opengb/issues/89)) ([608d890](https://github.com/rivet-gg/opengb/commit/608d8909dc1c121138751f583c13c18efde79bab))
* correctly empty dirs before copy ([e43597e](https://github.com/rivet-gg/opengb/commit/e43597e2bcaf790fc20aa1813d4aed16d5d211df))
* correctly empty dirs before copy ([#156](https://github.com/rivet-gg/opengb/issues/156)) ([94e136b](https://github.com/rivet-gg/opengb/commit/94e136b83687bada5cc48819598ce7e5a8f4038c))
* db connection with neon driver ([4d5b649](https://github.com/rivet-gg/opengb/commit/4d5b64907cddfdbd15b121fa7f17ccaa9a46fcd1))
* db connection with neon driver fix: bundle output with wasm ([#170](https://github.com/rivet-gg/opengb/issues/170)) ([c34d210](https://github.com/rivet-gg/opengb/commit/c34d210b51876460e50c69a33ad272c4bf00f19b))
* **db:** Fix default postgres login password ([f5e1e09](https://github.com/rivet-gg/opengb/commit/f5e1e09cd94e8c87bfb252295809f2ab7eeee071))
* **db:** Fix default postgres login password ([#141](https://github.com/rivet-gg/opengb/issues/141)) ([497b763](https://github.com/rivet-gg/opengb/commit/497b763c687e952c7c1b3cd6ae4f7f7e57e63b1e))
* **db:** Fixed prisma error on db migration and added `env` option to not generate sync schema (for CI) ([70888dc](https://github.com/rivet-gg/opengb/commit/70888dc2881fb0f900a4948162acf658262594a3))
* **db:** Made choice of `dev`/`deploy` in `prisma migrate &lt;&gt;` and addition of `-it` in `docker` dependent on environment CI/TTY status. ([#165](https://github.com/rivet-gg/opengb/issues/165)) ([920ac27](https://github.com/rivet-gg/opengb/commit/920ac277dd0f5378cf8c3cc1ae414340dc6d76a6))
* disable prisma schema lock in dev ([#225](https://github.com/rivet-gg/opengb/issues/225)) ([2c9d6a5](https://github.com/rivet-gg/opengb/commit/2c9d6a54e750abad1d832a81e7e42ebb9ddac3a5))
* dynamically lookup local registry modules path ([#197](https://github.com/rivet-gg/opengb/issues/197)) ([40921f0](https://github.com/rivet-gg/opengb/commit/40921f0ec530cc39aec95f88981484284b4afe30))
* false positives on compare hash logic in batches ([#230](https://github.com/rivet-gg/opengb/issues/230)) ([3aab9bc](https://github.com/rivet-gg/opengb/commit/3aab9bc2abcb8105fc3af837900ce4f7a932ad17))
* gen files getting clobbered in external modules ([#286](https://github.com/rivet-gg/opengb/issues/286)) ([0b8eb76](https://github.com/rivet-gg/opengb/commit/0b8eb7686c969276acf35b6cbc76bcc8bd53c439))
* **gen:** Fix misc generated files and imports ([f71ee4f](https://github.com/rivet-gg/opengb/commit/f71ee4f8a15eb43cf70f08139108a485cb513cad))
* **gen:** Fix misc generated files and imports ([#142](https://github.com/rivet-gg/opengb/issues/142)) ([90cdba1](https://github.com/rivet-gg/opengb/commit/90cdba1d4f52c54cab45b43e9ea076817d380f79))
* migrate dev directory filter not working ([e0616d5](https://github.com/rivet-gg/opengb/commit/e0616d5954a440ac59385b38be7f7bb890c43d4a))
* migrate dev directory filter not working ([#154](https://github.com/rivet-gg/opengb/issues/154)) ([f1fb045](https://github.com/rivet-gg/opengb/commit/f1fb0454f7644cba8f73a77a097603315b3febd0))
* migrateDev now gets passed createOnly ([aee3a50](https://github.com/rivet-gg/opengb/commit/aee3a501d01a608e491b8fe1d3e07f79c8884830))
* migrateDev now gets passed createOnly ([#106](https://github.com/rivet-gg/opengb/issues/106)) ([ec59c95](https://github.com/rivet-gg/opengb/commit/ec59c952fa82fc1190da7d6ca38e7ac0462262e1))
* migrations not getting copied ([#198](https://github.com/rivet-gg/opengb/issues/198)) ([5165665](https://github.com/rivet-gg/opengb/commit/5165665ff8d6eb0319c20c2e99a5d96d8db3ad05))
* misc formatting fixes ([8f3915d](https://github.com/rivet-gg/opengb/commit/8f3915d3cefda9dd89e568896d78b8e349c17a60))
* misc formatting fixes ([#169](https://github.com/rivet-gg/opengb/issues/169)) ([5ea0100](https://github.com/rivet-gg/opengb/commit/5ea0100de9b5e4d569018de7672114b4a09a6f65))
* preserve module _gen dir when coming from external repo ([#191](https://github.com/rivet-gg/opengb/issues/191)) ([095e281](https://github.com/rivet-gg/opengb/commit/095e28178a6e497c25db5badf4f60872cbf84815))
* print err when failing to start postgres container ([bc4d717](https://github.com/rivet-gg/opengb/commit/bc4d717428c83dd65b5dd0a715a70f74e79a2585))
* print err when failing to start postgres container ([#122](https://github.com/rivet-gg/opengb/issues/122)) ([bd16d90](https://github.com/rivet-gg/opengb/commit/bd16d906b22f28b936c06f276cf55b957339537a))
* prisma client generation sporadically failling ([#192](https://github.com/rivet-gg/opengb/issues/192)) ([1ec9d67](https://github.com/rivet-gg/opengb/commit/1ec9d67fc27bb88a5a6305231c4d544bfd3a938a))
* ray id typescript error ([#344](https://github.com/rivet-gg/opengb/issues/344)) ([43b9e6b](https://github.com/rivet-gg/opengb/commit/43b9e6bd86273d35744136f94c4ff9d2383e4ce4))
* read managed solution env var for postgres ([c66864d](https://github.com/rivet-gg/opengb/commit/c66864d0b91d38fd13bb9ec61e79556896b37b81))
* read managed solution env var for postgres ([8320265](https://github.com/rivet-gg/opengb/commit/83202656d564e099fba7e5e343b46e10d15b43dc))
* read managed solution env var for postgres ([4091021](https://github.com/rivet-gg/opengb/commit/409102131c04b4177be1e4657b59d7614eceb1e4))
* read ray id header from cloudflare ([#327](https://github.com/rivet-gg/opengb/issues/327)) ([8cec012](https://github.com/rivet-gg/opengb/commit/8cec012d69a21e29c45fb085e2ff8d28cf7a9241))
* remove extra ogs reference ([#190](https://github.com/rivet-gg/opengb/issues/190)) ([e230b7f](https://github.com/rivet-gg/opengb/commit/e230b7f0083f4d4ef6c3e0b2c359ee2599e48751))
* Resolve issue with missing `adapterName` in generated prisma helpers ([#263](https://github.com/rivet-gg/opengb/issues/263)) ([911da30](https://github.com/rivet-gg/opengb/commit/911da30272cd626ea5efa99912412856b160e491))
* SDK generation ([#93](https://github.com/rivet-gg/opengb/issues/93)) ([d9e28cb](https://github.com/rivet-gg/opengb/commit/d9e28cb8979b32e2607e58adfa05025b9bc89978))
* **server:** update request handler to work for cloudflare workers ([#320](https://github.com/rivet-gg/opengb/issues/320)) ([3aa8492](https://github.com/rivet-gg/opengb/commit/3aa8492acd91e336211aea174d25bed0a57ae968))
* **setup:** Create `artifacts` folder if it doesn't already exist ([9ef3430](https://github.com/rivet-gg/opengb/commit/9ef34309b8a3ab464c76c5b9d8cd1e9a67876ee3))
* **setup:** Create `artifacts` folder if it doesn't already exist ([#115](https://github.com/rivet-gg/opengb/issues/115)) ([6955079](https://github.com/rivet-gg/opengb/commit/69550799404e16fe6480330a257e64fae3662b58))
* sporadic postgres connection failure in build steps ([#194](https://github.com/rivet-gg/opengb/issues/194)) ([8702758](https://github.com/rivet-gg/opengb/commit/8702758a475a4051ce78bafc2021be493031684e))
* templated script has wrong test imports ([#183](https://github.com/rivet-gg/opengb/issues/183)) ([9e2b43b](https://github.com/rivet-gg/opengb/commit/9e2b43bda1abfca83157f8edeb1261b9417df519))
* **tests:** update default config for users module ([#287](https://github.com/rivet-gg/opengb/issues/287)) ([b10d158](https://github.com/rivet-gg/opengb/commit/b10d15875b793d69bcad4b286d7ecceeaec82182))
* typo in script list ([16baa37](https://github.com/rivet-gg/opengb/commit/16baa37c37aa9aeb28c5416b13400a205b61bd1e))
* typo in script list ([#150](https://github.com/rivet-gg/opengb/issues/150)) ([5780f48](https://github.com/rivet-gg/opengb/commit/5780f489936ba98b35ebef428c0e3617f7a9329c))
* uanble to connect to postgres in ci ([50f33bb](https://github.com/rivet-gg/opengb/commit/50f33bb53e2b62c75868408b7a839bf8f472fab4))
* use module-specific env vars for migrations ([af18a0b](https://github.com/rivet-gg/opengb/commit/af18a0bbb93004b1c5628201f5416b4492281f19))
* use module-specific env vars for migrations ([#220](https://github.com/rivet-gg/opengb/issues/220)) ([349d05a](https://github.com/rivet-gg/opengb/commit/349d05ab396492e98ae07876838ae13adbabe609))


### Performance Improvements

* Generate camelCase map at build time, simplify registry proxy ([#174](https://github.com/rivet-gg/opengb/issues/174)) ([f1d638a](https://github.com/rivet-gg/opengb/commit/f1d638a6af7612480e388623ebf0d776e659459a))


### Documentation

* coding conventions ([b0e7ef8](https://github.com/rivet-gg/opengb/commit/b0e7ef890e1796139b5678c28f009542fd23a93f))
* coding conventions ([#152](https://github.com/rivet-gg/opengb/issues/152)) ([32f0437](https://github.com/rivet-gg/opengb/commit/32f04375a0ea2dba7f257e03f5b15cacd298974a))


### Code Refactoring

* Rewrite `buildRegistryProxy` and comment `src/runtime/proxy.ts` to make it more understandable by maintainers and contributors ([#269](https://github.com/rivet-gg/opengb/issues/269)) ([b328a7d](https://github.com/rivet-gg/opengb/commit/b328a7dbba8ed626c4f9dd9540e416ddaf915213))
* Rewrite all codegen using the new `GeneratedCodeBuilder` class + move everything to `./src/build/gen` ([#275](https://github.com/rivet-gg/opengb/issues/275)) ([15572c7](https://github.com/rivet-gg/opengb/commit/15572c78648f9037168b564228c9614548cbf98a))


### Continuous Integration

* Add release-please GitHub Action ([#259](https://github.com/rivet-gg/opengb/issues/259)) ([16acad9](https://github.com/rivet-gg/opengb/commit/16acad98d4a22316d040f189ec225ac13c62ed96))
* add test for registry ([#348](https://github.com/rivet-gg/opengb/issues/348)) ([ced220c](https://github.com/rivet-gg/opengb/commit/ced220ca218b756a6b828f61c745bf3e248dc89c))


### Chores

* add back all deps to test project ([503dcaa](https://github.com/rivet-gg/opengb/commit/503dcaa04355c37c13ad2931ac9255f0c620b55f))
* add back all deps to test project ([#157](https://github.com/rivet-gg/opengb/issues/157)) ([b709401](https://github.com/rivet-gg/opengb/commit/b709401ea41bee8a4e796316b1792915f4a23206))
* add core tests to ci ([9bf7b42](https://github.com/rivet-gg/opengb/commit/9bf7b4262ba19f3dcde7221e50dd2db437d1d21e))
* add core tests to ci ([#149](https://github.com/rivet-gg/opengb/issues/149)) ([61f9ede](https://github.com/rivet-gg/opengb/commit/61f9ede48588d7ec92cd14226fb61f845c3b81c1))
* add global pool state that limits active workers across multiple pools ([5bbc474](https://github.com/rivet-gg/opengb/commit/5bbc474e5c9d31d76596f2f991c57657012bb632))
* add global pool state that limits active workers across multiple pools ([#173](https://github.com/rivet-gg/opengb/issues/173)) ([52d9300](https://github.com/rivet-gg/opengb/commit/52d930097df67b4def884666815c40921c11094a))
* archive binary files as base64 instead of text ([#347](https://github.com/rivet-gg/opengb/issues/347)) ([f6c479a](https://github.com/rivet-gg/opengb/commit/f6c479a8e5058f13c0ad3ec69d4093c028d45ea3))
* clean up code gen using dedent ([2e17afd](https://github.com/rivet-gg/opengb/commit/2e17afda11670e35de3967e002feef69930343b0))
* clean up code gen using dedent ([#126](https://github.com/rivet-gg/opengb/issues/126)) ([d934f06](https://github.com/rivet-gg/opengb/commit/d934f069c17f39d924a42490471d512401ce806d))
* cleanly archive dynamic files at build time ([#343](https://github.com/rivet-gg/opengb/issues/343)) ([e89bdb5](https://github.com/rivet-gg/opengb/commit/e89bdb561641a3958d848d29ce969ef701ad4419))
* **devex:** Expose helper Empty type ([aeeab4f](https://github.com/rivet-gg/opengb/commit/aeeab4f64c4cb4e1de4c868224412cf6a1d44a47))
* **devex:** Expose helper Empty type ([#175](https://github.com/rivet-gg/opengb/issues/175)) ([206f8eb](https://github.com/rivet-gg/opengb/commit/206f8eb247c64743abf22d489eff42abd2304a1b))
* differentiate external vs local modules ([1dd2bfa](https://github.com/rivet-gg/opengb/commit/1dd2bfa690edc9c91d21442c182809ef5f4eda59))
* differentiate external vs local modules ([#160](https://github.com/rivet-gg/opengb/issues/160)) ([36705d2](https://github.com/rivet-gg/opengb/commit/36705d20c6c9342181ff5523ab82972cff33e074))
* doc moving issue ([6a8bc7d](https://github.com/rivet-gg/opengb/commit/6a8bc7d71f4054dc6d298666064ac9c946b98a42))
* doc moving issue ([#102](https://github.com/rivet-gg/opengb/issues/102)) ([c82ff3f](https://github.com/rivet-gg/opengb/commit/c82ff3fd285115f1800e901f294ad6bda881fd4e))
* **docs:** migrate mintlify docs in to monorepo ([#335](https://github.com/rivet-gg/opengb/issues/335)) ([151a017](https://github.com/rivet-gg/opengb/commit/151a017f1b183150dc79458de54313ff5977cb0b))
* enable verbose logging in ci ([#202](https://github.com/rivet-gg/opengb/issues/202)) ([4ed5328](https://github.com/rivet-gg/opengb/commit/4ed53283dff69eb1c844443d06a93b9108ff68b3))
* fix lints ([f2ac3c3](https://github.com/rivet-gg/opengb/commit/f2ac3c30223f9dc966df348366dae336bf4362a6))
* fix lints ([#129](https://github.com/rivet-gg/opengb/issues/129)) ([3557d0a](https://github.com/rivet-gg/opengb/commit/3557d0ac153d8197c31abf5ef5eb4fb9634d3776))
* fmt & lints ([#346](https://github.com/rivet-gg/opengb/issues/346)) ([ea8853c](https://github.com/rivet-gg/opengb/commit/ea8853cbd2e796efd9c1f02dd1bece0e4d20ee2b))
* improve error for invalid configs ([#285](https://github.com/rivet-gg/opengb/issues/285)) ([4e5cdad](https://github.com/rivet-gg/opengb/commit/4e5cdad5150a87308e63fc3f6ba0dbe495d7aed6))
* migrate core modules to esm.sh ([#350](https://github.com/rivet-gg/opengb/issues/350)) ([20b59db](https://github.com/rivet-gg/opengb/commit/20b59db040e29a7e6f2062cd5c01b482c2de0bd3))
* migrate opengb-registry -&gt; opengb-modules ([#340](https://github.com/rivet-gg/opengb/issues/340)) ([d247137](https://github.com/rivet-gg/opengb/commit/d247137fcd84d2950d1622ecf64c2744440b14a0))
* migrate yaml -&gt; json ([#339](https://github.com/rivet-gg/opengb/issues/339)) ([4fd9e1b](https://github.com/rivet-gg/opengb/commit/4fd9e1b3fd18a0ea91039f2827e1d72081a7ed8d))
* move ajv & tjs to individual deps.ts ([e7be9dc](https://github.com/rivet-gg/opengb/commit/e7be9dcca26e893cdefd93e1afafbe5ee2dd619c))
* move ajv & tjs to individual deps.ts ([#112](https://github.com/rivet-gg/opengb/issues/112)) ([3567cba](https://github.com/rivet-gg/opengb/commit/3567cbaffe8f217996ad6f96baf47b352f3a733e))
* move engine -&gt; src ([b653008](https://github.com/rivet-gg/opengb/commit/b6530088ac2a29c7bf936c1bf82351f076d12dd8))
* move engine -&gt; src ([#74](https://github.com/rivet-gg/opengb/issues/74)) ([70c238f](https://github.com/rivet-gg/opengb/commit/70c238fff1ae52f0d1e22e5fbdc3f2c139cb97ae))
* move from deno.json to deps.ts for standalone cli ([1129b65](https://github.com/rivet-gg/opengb/commit/1129b657d47b68405907f0abfcfe35537e2dc9ab))
* move from deno.json to deps.ts for standalone cli ([#80](https://github.com/rivet-gg/opengb/issues/80)) ([40d2252](https://github.com/rivet-gg/opengb/commit/40d225219a47fd254a71de07708195ac165b1090))
* move generated files to `module.gen.ts` & move project `_gen` to `.opengb` ([#283](https://github.com/rivet-gg/opengb/issues/283)) ([6d0e6d5](https://github.com/rivet-gg/opengb/commit/6d0e6d5ad0f2038e4b5ea3e0505317b41edd0ebe))
* move modules to separate repo ([e2a97fd](https://github.com/rivet-gg/opengb/commit/e2a97fdf085256f864c080a67c44077326d90b5f))
* move modules to separate repo ([#70](https://github.com/rivet-gg/opengb/issues/70)) ([cbae292](https://github.com/rivet-gg/opengb/commit/cbae292cc3a8d077b6c9763829796cd975779196))
* move tests/test_project -&gt; tests/basic ([5e0ba5b](https://github.com/rivet-gg/opengb/commit/5e0ba5ba8132f00a9589bb629287a6492cabb65f))
* move tests/test_project -&gt; tests/basic ([#158](https://github.com/rivet-gg/opengb/issues/158)) ([5507e8f](https://github.com/rivet-gg/opengb/commit/5507e8f036973ef112b0bd0b84661032de65975b))
* pre-generate artifacts for cli ([7bb8d77](https://github.com/rivet-gg/opengb/commit/7bb8d7739cf27c142e0ebea3c364a9c9d2a6a562))
* pre-generate artifacts for cli ([22d266d](https://github.com/rivet-gg/opengb/commit/22d266df405cd23dd327f3ab0e653ecab8340f17))
* pre-generate module & project schemas ([7bb8d77](https://github.com/rivet-gg/opengb/commit/7bb8d7739cf27c142e0ebea3c364a9c9d2a6a562))
* pre-generate module & project schemas ([0b121ef](https://github.com/rivet-gg/opengb/commit/0b121eff6fc27f1279e51f303225f15d51837228))
* pre-generate module & project schemas ([#105](https://github.com/rivet-gg/opengb/issues/105)) ([7bb8d77](https://github.com/rivet-gg/opengb/commit/7bb8d7739cf27c142e0ebea3c364a9c9d2a6a562))
* pre-warm prisma cli & engines ([#353](https://github.com/rivet-gg/opengb/issues/353)) ([19c59d2](https://github.com/rivet-gg/opengb/commit/19c59d299a845aa058e5dfb57272d4299daf10fb))
* refactor build cache -&gt; build state ([#186](https://github.com/rivet-gg/opengb/issues/186)) ([19b4a9f](https://github.com/rivet-gg/opengb/commit/19b4a9f05a7ebe547f51559b761ccb44120b5dc6))
* release 0.1.0 ([d3d8767](https://github.com/rivet-gg/opengb/commit/d3d8767fda90571fbb32420e765650bbe0314ddd))
* remove dynamic from runtime archive ([#349](https://github.com/rivet-gg/opengb/issues/349)) ([67bbe62](https://github.com/rivet-gg/opengb/commit/67bbe62639a36fa6cbc48bf36b340b1ce4c9d176))
* remove excess logs ([5cc5818](https://github.com/rivet-gg/opengb/commit/5cc5818a6efd51ee758e1cbb33bd9effeadb24e4))
* remove excess logs ([#111](https://github.com/rivet-gg/opengb/issues/111)) ([a24eb68](https://github.com/rivet-gg/opengb/commit/a24eb68b6307b7dade4a8827ee789541e84835a4))
* remove FORCE_BUILD ([843bd06](https://github.com/rivet-gg/opengb/commit/843bd066702a7749676c6e8f465c0c73a58bdea1))
* remove uses of __dirname and __filename ([e08483b](https://github.com/rivet-gg/opengb/commit/e08483b734e07f1c1dccc04869a4fb910ea719ed))
* remove uses of __dirname and __filename ([#104](https://github.com/rivet-gg/opengb/issues/104)) ([5d6f66f](https://github.com/rivet-gg/opengb/commit/5d6f66fd081f71abd5f083c3441b45065e69dcbd))
* rename build pipeline registry -&gt; project ([554317e](https://github.com/rivet-gg/opengb/commit/554317eb0c3918f12b2d3cb7629dc3c036c15ffd))
* rename build pipeline registry -&gt; project ([#75](https://github.com/rivet-gg/opengb/issues/75)) ([0a25ad1](https://github.com/rivet-gg/opengb/commit/0a25ad14223f760f02f448e878dd2e4f42b3816f))
* rename ogs.yaml to backend.yaml ([c2bae4e](https://github.com/rivet-gg/opengb/commit/c2bae4ee6544ae890b0b6b70e799bb9e373de25a))
* rename ogs.yaml to backend.yaml ([#127](https://github.com/rivet-gg/opengb/issues/127)) ([1ee9c4c](https://github.com/rivet-gg/opengb/commit/1ee9c4c3da1d17365218107772dbec910603488f))
* rename to open game backend ([5a786e9](https://github.com/rivet-gg/opengb/commit/5a786e9125248d7931b8f57ba19538ced00ed8fb))
* rename to open game backend ([#97](https://github.com/rivet-gg/opengb/issues/97)) ([801ff34](https://github.com/rivet-gg/opengb/commit/801ff3499749111d27d55548d507af3df4a953d8))
* replace "dev start" with "start" command ([5cb22fd](https://github.com/rivet-gg/opengb/commit/5cb22fd2cb0d38dec3e6e946729468c16a57c359))
* replace "dev start" with "start" command ([#121](https://github.com/rivet-gg/opengb/issues/121)) ([7572051](https://github.com/rivet-gg/opengb/commit/7572051522b37ee5b4ced9478bdc6fc37041dd8d))
* replace default watch with --unstable-watch flag ([b4ebf72](https://github.com/rivet-gg/opengb/commit/b4ebf72267d985aa23003ff49e2b4709b268a8e5))
* replace default watch with --unstable-watch flag ([#132](https://github.com/rivet-gg/opengb/issues/132)) ([6e8b825](https://github.com/rivet-gg/opengb/commit/6e8b825321b234b1c6ee5bf9b6e53e10e0a97148))
* replace join with resolve ([02f2ae7](https://github.com/rivet-gg/opengb/commit/02f2ae7694cc62d6c39a0271bbe6efc9337184a3))
* replace join with resolve ([#145](https://github.com/rivet-gg/opengb/issues/145)) ([fe97a34](https://github.com/rivet-gg/opengb/commit/fe97a34390a0bd487460fb07278f6a9e890c1112))
* replace old/new cache with diffs for the current process ([#187](https://github.com/rivet-gg/opengb/issues/187)) ([e8d091b](https://github.com/rivet-gg/opengb/commit/e8d091becad39a43b97902c364aa4b2fdd43655b))
* restrict archived runtime files ([74fc14d](https://github.com/rivet-gg/opengb/commit/74fc14dc20d67c31e1cc0511d8dfe25832490672))
* restrict archived runtime files ([#130](https://github.com/rivet-gg/opengb/issues/130)) ([709c608](https://github.com/rivet-gg/opengb/commit/709c6085408a45c8db941d257ac291522972e505))
* reuse prisma workspace to speed up db commands ([3955f35](https://github.com/rivet-gg/opengb/commit/3955f35ede7032d0a3efdc97dd62fe5e5931d529))
* reuse prisma workspace to speed up db commands ([#161](https://github.com/rivet-gg/opengb/issues/161)) ([b75acc7](https://github.com/rivet-gg/opengb/commit/b75acc7be7ec3a118af0bdd8f867e673b7317ae1))
* rework caching to isolate hashes to each step id ([78861aa](https://github.com/rivet-gg/opengb/commit/78861aabb079b3d4df5b8cece7c83514528c4ac7))
* standardize DatabaseT name ([#182](https://github.com/rivet-gg/opengb/issues/182)) ([af80956](https://github.com/rivet-gg/opengb/commit/af80956473c68bdeba09b66484810e6ab130d76b))
* substitude node dependency with docker container for prisma commands ([bf2ecd4](https://github.com/rivet-gg/opengb/commit/bf2ecd4782f74e2cbe261393f203f87a53da9eed))
* substitude node dependency with docker container for prisma commands ([#162](https://github.com/rivet-gg/opengb/issues/162)) ([a1b376e](https://github.com/rivet-gg/opengb/commit/a1b376eb6a8f00e320a4ae5da03924fcd16bb050))
* **task:** upgrade deno install command ([#280](https://github.com/rivet-gg/opengb/issues/280)) ([bd25a2c](https://github.com/rivet-gg/opengb/commit/bd25a2cf64509825518853d7a2d89c841611c22c))
* temp disable actor dynamic codegen ([#331](https://github.com/rivet-gg/opengb/issues/331)) ([fdd55c5](https://github.com/rivet-gg/opengb/commit/fdd55c5934d0de20d35338da62fd916a1c85c569))
* test templating e2e ([aada0b9](https://github.com/rivet-gg/opengb/commit/aada0b9cdc48701e1edeebe01a8cf2e5446f8a21))
* test templating e2e ([#148](https://github.com/rivet-gg/opengb/issues/148)) ([401535b](https://github.com/rivet-gg/opengb/commit/401535b5bed50f6efa1b4ee1003b131ab1d3ecd1))
* update build step description to specify module & script ([#226](https://github.com/rivet-gg/opengb/issues/226)) ([e8e5989](https://github.com/rivet-gg/opengb/commit/e8e598927954c49542020ec4dfba3b64e74cdd92))
* update default registry ([#284](https://github.com/rivet-gg/opengb/issues/284)) ([25b8e55](https://github.com/rivet-gg/opengb/commit/25b8e554a786cc38326f221106a4f50081c319ce))
* update generated type paths to work with multiple registries ([a614355](https://github.com/rivet-gg/opengb/commit/a6143559b06800935317baac7fd1b82294b8dc1c))
* update generated type paths to work with multiple registries ([#87](https://github.com/rivet-gg/opengb/issues/87)) ([d112067](https://github.com/rivet-gg/opengb/commit/d112067cd4f6e9fa03a5b4f68bcea84ea9c39edc))
* update getting started in readme ([5241d2e](https://github.com/rivet-gg/opengb/commit/5241d2ecb71e42c256e899e988d35246ea72f766))
* update getting started in readme ([#103](https://github.com/rivet-gg/opengb/issues/103)) ([ef563cc](https://github.com/rivet-gg/opengb/commit/ef563ccd0dc145311d5249458034e6b632655d03))
* update registry ([#332](https://github.com/rivet-gg/opengb/issues/332)) ([0f6dc87](https://github.com/rivet-gg/opengb/commit/0f6dc870d7706af80ca9d45d169bce7e031ca800))
* validate local registry ([#196](https://github.com/rivet-gg/opengb/issues/196)) ([9fc8c4f](https://github.com/rivet-gg/opengb/commit/9fc8c4f28c18f1637b85fdb3cdedf81b034d2f8a))
