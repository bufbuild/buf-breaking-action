.PHONY: build
build:
	@tsc
	@eslint ./src
	@esbuild \
		--minify \
		--bundle \
		--sourcemap \
		'--define:process.env.NODE_ENV="production"' \
		--outdir=dist \
		--platform=node \
		--target=node16 \
		./src/main.ts
