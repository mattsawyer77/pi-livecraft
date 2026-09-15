{
  description = "Pi Livecraft desktop build";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        lib = pkgs.lib;
        source = lib.cleanSourceWith {
          src = self;
          filter = path: type:
            let name = baseNameOf path;
            in !(builtins.elem name [
              "node_modules"
              "dist"
              "dist-desktop"
              "dist-runtime"
              "release"
              ".git"
            ]);
        };
        desktop = pkgs.buildNpmPackage {
          pname = "pi-livecraft-desktop";
          version = "1.2.0";
          src = source;
          npmDepsHash = "sha256-4+3hB8OuiWgkjP2ikL004lHCbzaDRXO0bXi1GQtQVc8=";
          nativeBuildInputs = [ pkgs.nodejs_24 pkgs.zip pkgs.darwin.cctools ];
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
          ELECTRON_BUILDER_CACHE = "$TMPDIR/electron-builder-cache";
          buildPhase = ''
            runHook preBuild
            export HOME="$TMPDIR/home"
            electronDist="$TMPDIR/electron-dist"
            mkdir -p "$HOME" "$ELECTRON_BUILDER_CACHE" "$electronDist"
            cp -R "${pkgs.electron}/Applications/Electron.app" "$electronDist/"
            chmod -R u+w "$electronDist/Electron.app"
            npm run desktop:build
            npm exec electron-builder -- --config desktop/electron-builder.yml \
              --mac --arm64 --publish never \
              --config.electronDist="$electronDist"
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p "$out"
            find release -maxdepth 1 -type f \( -name '*.zip' -o -name '*.dmg' \) -exec cp {} "$out/" \;
            runHook postInstall
          '';
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_24 ];
          ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
        };
        packages.desktop = if system == "aarch64-darwin" then desktop else
          throw "Pi Livecraft desktop artifacts must be built natively with nix build .#desktop on aarch64-darwin";
      });
}
