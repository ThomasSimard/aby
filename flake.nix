{
  description = "aby - a pi-based learning tutor, plus dev tooling";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    claude-code.url = "github:sadjow/claude-code-nix";
  };

  # `claude-code` is deliberately NOT bound as a bare argument here: the flake
  # input would shadow pkgs.claude-code inside `with pkgs;` and get passed to
  # mkShell as a plain attrset.
  outputs = { self, nixpkgs, flake-utils, ... }@inputs:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ inputs.claude-code.overlays.default ];
          config.allowUnfreePredicate = pkg:
            builtins.elem (nixpkgs.lib.getName pkg) [ "claude-code" ];
        };

        # @lancedb/lancedb and the ONNX embedding runtime ship prebuilt .node
        # addons that dlopen libstdc++/libgcc_s/libz/libssl. nix-ld alone does
        # not cover dlopen from a Nix-provided node, so the shell exports these.
        nativeAddonLibs = pkgs.lib.makeLibraryPath [
          pkgs.stdenv.cc.cc.lib
          pkgs.zlib
          pkgs.openssl
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            claude-code

            # aby runs as a package inside the pi agent harness
            pi-coding-agent

            nodejs_24
            pnpm

            # renders the roadmap DAG (dot -Tsvg)
            graphviz

            # aby_check shells out to this for CAS verification. sympy alone covers
            # both the symbolic and the numeric tier -- N() does the arithmetic --
            # so numpy/scipy would only enlarge the closure.
            (python3.withPackages (ps: with ps; [ sympy ]))

            fd
            jq
          ];

          shellHook = ''
            export LD_LIBRARY_PATH="${nativeAddonLibs}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

            echo "Dev shell ready."
            echo "  pi      - agent harness (aby loads via 'pi -e ./')"
            echo "  claude  - Claude Code"
          '';
        };
      });
}
