all: examples

build-%:
	@cd $(shell echo $@ | sed s/^build-//) && yarn && yarn build

examples: build-hello-world-haiku build-transcription build-chatgpt-clone build-polyfire-components

clean-%:
	@cd $(shell echo $@ | sed s/^clean-//) && rm -rf node_modules

clean: clean-hello-world-haiku clean-transcription clean-chatgpt-clone clean-polyfire-components

.PHONY: examples clean
