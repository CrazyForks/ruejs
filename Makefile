ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

.PHONY: dev build

dev:
	cd $(ROOT)/packages/swc-plugin-rue && npm run build
	cd $(ROOT)/packages/runtime-vapor && npm run build-dev && npm run build-vapor-dev
	cd $(ROOT) && npm run app-dev

build:
	cd $(ROOT)/packages/swc-plugin-rue && npm run build
	cd $(ROOT)/packages/runtime-vapor && npm run build && npm run build-vapor
	cd $(ROOT) && npm run app-build
