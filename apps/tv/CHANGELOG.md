# Changelog

## [1.0.1](https://github.com/aielbaz/noir/compare/v1.0.0...v1.0.1) (2026-11-11)


### Bug Fixes

* **home:** refresh lists without reloading open screens; swap the banner only after its image is decoded and the remote is idle ([592b242](https://github.com/aielbaz/noir/commit/592b242722c93bf07b499502a4119fae030e527c))
* **nav:** add a fade behind the sidebar and move the rail closer to the edge ([e020986](https://github.com/aielbaz/noir/commit/e020986d09fa832acc816e9864fe92961893a12e))
* **player:** clearer seeking, simpler controls, Up next card, and a Back hook ([79ae163](https://github.com/aielbaz/noir/commit/79ae1631ffed38bc751a02d16bc4b5a812c86c64))
* **player:** focus the play button when Up or Down wakes the controls; split the player into hooks and components ([16d8f3a](https://github.com/aielbaz/noir/commit/16d8f3ab8e76c2dcd480a13fc4447017a198445b))
* **player:** only the arrows stage a seek; the 10-second buttons, rewind/fast-forward keys and bar clicks jump directly with no cancel notice ([9c7c2d0](https://github.com/aielbaz/noir/commit/9c7c2d0c8271edbeb96e0ecc69436fe956241f81))
* **player:** show how far a direct jump went ([bdc3adb](https://github.com/aielbaz/noir/commit/bdc3adbcb82b36c976c23e64f1997ede87d4985a))
* **player:** the 10-second buttons seek at once instead of waiting to be confirmed ([d8c2495](https://github.com/aielbaz/noir/commit/d8c2495e9c9dd98a49a026e6967d77eb75d02a27))


### Performance Improvements

* **home:** show the banner from list data on a first launch, keep movies with no backdrop (poster shown), and apply updated details in place ([49533e8](https://github.com/aielbaz/noir/commit/49533e8305d6b85dcb15e33beaeb7f1d764c3253))
