all: clean build

.PHONY: all clean build firefox chrome validate screenshots social

# clean
clean:
	rm -rf dist/*

# build
build:
	mkdir -p dist/firefox dist/chrome

	# copy browser-specific manifests
	cp src/manifest-firefox.json dist/firefox/manifest.json
	cp src/manifest-chrome.json dist/chrome/manifest.json

	# copy background.js
	cp src/background.js dist/firefox
	cp src/background.js dist/chrome
	
	# copy popup
	cp -rf src/popup dist/firefox
	cp -rf src/popup dist/chrome

	# copy icons
	cp -rf src/icons dist/firefox
	cp -rf src/icons dist/chrome

	# copy the settings page, and the modules it shares with the popup and
	# background.js
	cp -rf src/options dist/firefox
	cp -rf src/options dist/chrome
	cp -rf src/lib dist/firefox
	cp -rf src/lib dist/chrome

	# copy the vendored design system (the popup's CSS and fonts)
	cp -rf src/vendor dist/firefox
	cp -rf src/vendor dist/chrome

	# zip the folders without deleting the unpacked files
	(cd ./dist/firefox/; zip -r power-close.zip * -x "power-close.zip")
	(cd ./dist/chrome/; zip -r power-close.zip * -x "power-close.zip")

# build firefox only
firefox: clean
	mkdir -p dist/firefox
	cp src/manifest-firefox.json dist/firefox/manifest.json
	cp src/background.js dist/firefox
	cp -rf src/popup dist/firefox
	cp -rf src/icons dist/firefox
	cp -rf src/options dist/firefox
	cp -rf src/lib dist/firefox
	cp -rf src/vendor dist/firefox
	(cd ./dist/firefox/; zip -r power-close.zip * -x "power-close.zip")

# build chrome only
chrome: clean
	mkdir -p dist/chrome
	cp src/manifest-chrome.json dist/chrome/manifest.json
	cp src/background.js dist/chrome
	cp -rf src/popup dist/chrome
	cp -rf src/icons dist/chrome
	cp -rf src/options dist/chrome
	cp -rf src/lib dist/chrome
	cp -rf src/vendor dist/chrome
	(cd ./dist/chrome/; zip -r power-close.zip * -x "power-close.zip")

# validate manifests
validate:
	@echo "Validating manifests..."
	@python3 -m json.tool src/manifest-firefox.json > /dev/null && echo "✓ Firefox manifest is valid JSON"
	@python3 -m json.tool src/manifest-chrome.json > /dev/null && echo "✓ Chrome manifest is valid JSON"

# screenshots of the popup, light and dark, for the website and the README
# and a GIF of it in use; and the stores' screenshots, to
# dist/screenshots/chrome/ (1280x800, no alpha, five) and
# dist/screenshots/firefox/ (2400x1800) (needs Node 22+, Chrome and ffmpeg;
# see scripts/screenshots.mjs and scripts/store.html)
screenshots:
	node scripts/screenshots.mjs

# the social card (Open Graph, X), in English and Arabic, 1200x630, to
# website/img/social/ (needs Node 22+ and Chrome; see social/render.mjs)
social:
	node social/render.mjs
