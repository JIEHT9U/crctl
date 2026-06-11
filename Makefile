.PHONY: release build test typecheck

release:
	npx release-it

build:
	npm run build

test:
	npm test

typecheck:
	npm run typecheck
