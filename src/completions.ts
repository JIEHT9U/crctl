import type { Shell } from "./types";

export const FISH_COMPLETION = `
# crctl — fish completion

# Helper: get current subcommand from the command line (tokens before cursor,
# skipping the program name and any flags)
function __fish_crctl_current_sub
    set -l tokens (commandline -opc)
    for tok in $tokens[2..-1]
        switch $tok
            case '-*'
                continue
            case '*'
                echo $tok
                return
        end
    end
end

complete -c crctl -f -n '__fish_use_subcommand' -a 'start' -d 'Start Claude Code in remote-control mode'
complete -c crctl -f -n '__fish_use_subcommand' -a 'stop' -d 'Stop Claude Code session'
complete -c crctl -f -n '__fish_use_subcommand' -a 'status' -d 'Show Claude Code session status'
complete -c crctl -f -n '__fish_use_subcommand' -a 'attach' -d 'Attach to tmux session'
complete -c crctl -f -n '__fish_use_subcommand' -a 'detach' -d 'Detach from session without stopping it'
complete -c crctl -f -n '__fish_use_subcommand' -a 'link' -d 'Print browser link'
complete -c crctl -f -n '__fish_use_subcommand' -a 'restore' -d 'Re-start all registered sessions'
complete -c crctl -f -n '__fish_use_subcommand' -a 'service' -d 'Manage the autostart service'
complete -c crctl -f -n '__fish_use_subcommand' -a 'doctor' -d 'Check dependencies'
complete -c crctl -f -n '__fish_use_subcommand' -a 'setup' -d 'Install shell completions'
complete -c crctl -f -n '__fish_use_subcommand' -a 'generate' -d 'Generate completion script'
complete -c crctl -f -n '__fish_use_subcommand' -a 'update' -d 'Check for updates and upgrade'
complete -c crctl -f -n '__fish_use_subcommand' -a 'uninstall' -d 'Remove crctl and clean up'
complete -c crctl -f -s V -l version -d 'Version'
complete -c crctl -f -s h -l help -d 'Help'
complete -c crctl -f -n 'contains -- (__fish_crctl_current_sub) stop status' -s g -l global -d 'Apply to all sessions'
complete -c crctl -f -n 'contains -- (__fish_crctl_current_sub) generate' -a 'bash fish zsh' -d 'Shell type'
complete -c crctl -f -n 'contains -- (__fish_crctl_current_sub) service' -a 'install uninstall status' -d 'Service action'
`;

export const BASH_COMPLETION = `
# crctl — bash completion
_crctl() {
    local cur prev cmds
    cmds="start stop status attach detach link restore service doctor setup generate update uninstall"
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    case $prev in
        crctl)
            COMPREPLY=( $(compgen -W "\${cmds}" -- "\${cur}") )
            ;;
        generate)
            COMPREPLY=( $(compgen -W "bash fish zsh" -- "\${cur}") )
            ;;
        service)
            COMPREPLY=( $(compgen -W "install uninstall status" -- "\${cur}") )
            ;;
        stop|status)
            COMPREPLY=( $(compgen -W "-g --global" -- "\${cur}") )
            ;;
        *)
            COMPREPLY=( $(compgen -W "-h --help -V --version" -- "\${cur}") )
            ;;
    esac
}
complete -F _crctl crctl
`;

export const ZSH_COMPLETION = `
#compdef crctl
# crctl — zsh completion

_crctl() {
    local commands
    commands=(
        'start:Start Claude Code in remote-control mode'
        'stop:Stop Claude Code session'
        'status:Show Claude Code session status'
        'attach:Attach to tmux session'
        'detach:Detach from session without stopping it'
        'link:Print browser link'
        'restore:Re-start all registered sessions'
        'service:Manage the autostart service'
        'doctor:Check dependencies'
        'setup:Install shell completions'
        'generate:Generate completion script'
        'update:Check for updates and upgrade'
        'uninstall:Remove crctl and clean up'
    )

    _arguments -C \\
        '(- *){-V,--version}[Show version]' \\
        '(- *){-h,--help}[Show help]' \\
        '1: :->cmds' \\
        '*::arg:->args' && return 0

    case $state in
        cmds)
            _describe 'command' commands ;;
        args)
            case $words[1] in
                stop|status)
                    _arguments '(-g --global)'{-g,--global}'[Apply to all sessions]' ;;
                generate)
                    _arguments '1:shell:(bash fish zsh)' ;;
                service)
                    _arguments '1:action:(install uninstall status)' ;;
            esac ;;
    esac
}

_crctl "$@"
`;

export const SUPPORTED_SHELLS: Shell[] = ["bash", "fish", "zsh"];

/** Completion script for a shell, or null when the shell is not supported. */
export function getCompletionScript(shell: string): string | null {
  switch (shell) {
    case "fish":
      return FISH_COMPLETION.trim();
    case "bash":
      return BASH_COMPLETION.trim();
    case "zsh":
      return ZSH_COMPLETION.trim();
    default:
      return null;
  }
}
