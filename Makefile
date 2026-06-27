ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SOURCE_DIRS := app $(sort $(wildcard packages/*))
CLOC_EXCLUDE_DIRS := node_modules,target,dist,coverage,.turbo,.vite,.next,pkg,pkg-node
CLOC_INCLUDE_EXT := ts,tsx,js,jsx,mjs,cjs,rs,css,scss,less,html

.PHONY: dev build app-build app-static-build cloc deploy-site deploy-static-site

dev:
	cd $(ROOT)/packages/swc-plugin-rue && npm run build
	cd $(ROOT)/packages/runtime-vapor && npm run build-dev
	cd $(ROOT) && npm run app-dev

build:
	cd $(ROOT)/packages/swc-plugin-rue && npm run build
	cd $(ROOT)/packages/runtime-vapor && npm run build
	cd $(ROOT) && npm run app-build

app-build:
	cd $(ROOT) && npm run app-build

app-static-build:
	cd $(ROOT) && npm run app-static-build

cloc:
	@command -v cloc >/dev/null || { echo "cloc is required. Install it first."; exit 1; }
	@for dir in $(SOURCE_DIRS); do \
		if [ -d "$$dir" ]; then \
			echo ""; \
			echo "== $$dir =="; \
			cloc "$$dir" \
				--exclude-dir="$(CLOC_EXCLUDE_DIRS)" \
				--include-ext="$(CLOC_INCLUDE_EXT)" \
				--timeout 0 \
				--quiet; \
		fi; \
	done

deploy-site: app-build
	@COMMIT_MESSAGE="$(MSG)" $(ROOT)/scripts/deploy-site-public.sh

deploy-static-site: app-static-build
	@COMMIT_MESSAGE="$(MSG)" $(ROOT)/scripts/deploy-static-site-public.sh
