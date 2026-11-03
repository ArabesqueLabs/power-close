all: clean build

# Safari's background.js: Safari won't run a module service worker, so the
# modules background.js imports are joined into it, as one plain script (the
# popup and the settings page are pages, and load them as modules as they are)
define SAFARI_BACKGROUND
(echo "// Built by make from src/lib/settings.js, src/lib/match.js and src/background.js."; \
	 for f in src/lib/settings.js src/lib/match.js src/background.js; do \
	   echo; echo "// ---- $$f"; sed -e '/^import /d' -e 's/^export //' $$f; \
	 done) > dist/safari/background.js
endef

.PHONY: all clean build firefox chrome safari safari-files validate screenshots

# clean
clean:
	rm -rf dist/*

# build
build:
	mkdir -p dist/firefox dist/chrome dist/safari

	# copy browser-specific manifests
	cp src/manifest-firefox.json dist/firefox/manifest.json
	cp src/manifest-chrome.json dist/chrome/manifest.json
	cp src/manifest-safari.json dist/safari/manifest.json

	# copy background.js
	cp src/background.js dist/firefox
	cp src/background.js dist/chrome
	$(SAFARI_BACKGROUND)
	
	# copy popup
	cp -rf src/popup dist/firefox
	cp -rf src/popup dist/chrome
	cp -rf src/popup dist/safari

	# copy icons
	cp -rf src/icons dist/firefox
	cp -rf src/icons dist/chrome
	cp -rf src/icons dist/safari

	# copy the settings page, and the modules it shares with the popup and
	# background.js
	cp -rf src/options dist/firefox
	cp -rf src/options dist/chrome
	cp -rf src/options dist/safari
	cp -rf src/lib dist/firefox
	cp -rf src/lib dist/chrome
	cp -rf src/lib dist/safari

	# copy the vendored design system (the popup's CSS and fonts)
	cp -rf src/vendor dist/firefox
	cp -rf src/vendor dist/chrome
	cp -rf src/vendor dist/safari

	# zip the folders without deleting the unpacked files (Safari's isn't
	# zipped: Xcode builds it into the app, see safari/)
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

# Safari's extension files only, in dist/safari/, which the Xcode project in
# safari/ builds into the app: before building or archiving it in Xcode
safari-files:
	rm -rf dist/safari
	mkdir -p dist/safari
	cp src/manifest-safari.json dist/safari/manifest.json
	$(SAFARI_BACKGROUND)
	cp -rf src/popup dist/safari
	cp -rf src/icons dist/safari
	cp -rf src/options dist/safari
	cp -rf src/lib dist/safari
	cp -rf src/vendor dist/safari

# build safari only: the extension's files, and the app (macOS) around them,
# unsigned, to try locally: needs Xcode, and Safari's Develop > Allow
# Unsigned Extensions
safari: safari-files
	xcodebuild -project "safari/Power Close/Power Close.xcodeproj" -scheme "Power Close (macOS)" \
		-configuration Debug -derivedDataPath dist/safari-build \
		CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO DEVELOPMENT_TEAM= build
	@echo "Built dist/safari-build/Build/Products/Debug/Power Close.app: open it once, then turn it on in Safari's Settings > Extensions"

# validate manifests
validate:
	@echo "Validating manifests..."
	@python3 -m json.tool src/manifest-firefox.json > /dev/null && echo "✓ Firefox manifest is valid JSON"
	@python3 -m json.tool src/manifest-chrome.json > /dev/null && echo "✓ Chrome manifest is valid JSON"
	@python3 -m json.tool src/manifest-safari.json > /dev/null && echo "✓ Safari manifest is valid JSON"

# screenshots of the popup, light and dark, for power-close.com and the
# README and a GIF of it in use, to dist/screenshots/; and the stores' screenshots, to
# dist/screenshots/chrome/ (1280x800, no alpha, five),
# dist/screenshots/firefox/ (2400x1800) and dist/screenshots/safari/
# (2880x1800, and the Mac App Store's app preview, preview.mp4) (needs Node 22+, Chrome and ffmpeg;
# see scripts/screenshots.mjs and scripts/store.html)
screenshots:
	node scripts/screenshots.mjs
