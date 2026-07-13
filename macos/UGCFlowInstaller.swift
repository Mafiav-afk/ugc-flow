import AppKit
import Foundation

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow!
    private let status = NSTextField(labelWithString: "准备安装到本机")
    private let codex = NSButton(checkboxWithTitle: "部署到 Codex", target: nil, action: nil)
    private let claude = NSButton(checkboxWithTitle: "部署到 Claude Code", target: nil, action: nil)
    private let installButton = NSButton(title: "安装并启动 UGC Flow", target: nil, action: nil)
    private let openButton = NSButton(title: "打开 UGC Flow", target: nil, action: nil)
    private var appURL = URL(string: "http://127.0.0.1:18787")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildWindow()
        NSApp.activate(ignoringOtherApps: true)
    }

    private func buildWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 520, height: 390), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "UGC Flow 安装器"
        window.center()
        let root = NSView(frame: window.contentView!.bounds)
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        window.contentView = root

        let mark = NSTextField(labelWithString: "▶")
        mark.font = .systemFont(ofSize: 34, weight: .bold); mark.textColor = NSColor(calibratedRed: 0.95, green: 0.16, blue: 0.19, alpha: 1)
        let title = NSTextField(labelWithString: "UGC Flow")
        title.font = .systemFont(ofSize: 28, weight: .bold)
        let subtitle = NSTextField(wrappingLabelWithString: "本地智能体 UGC 带货工作流\nCodex / Claude 现有额度 · 25 套商家模板 · 媒体 API")
        subtitle.font = .systemFont(ofSize: 13); subtitle.textColor = .secondaryLabelColor
        let info = NSTextField(wrappingLabelWithString: "安装器会部署 UGC Skills，自动检测已登录的 Codex 或 Claude Code。文本推理使用智能体现有额度；图片/视频 API Key 仍只保存在浏览器会话。")
        info.font = .systemFont(ofSize: 11); info.textColor = .secondaryLabelColor
        codex.state = .on; claude.state = .on
        installButton.target = self; installButton.action = #selector(install)
        installButton.bezelStyle = .rounded; installButton.keyEquivalent = "\r"
        openButton.target = self; openButton.action = #selector(openApp); openButton.isHidden = true
        status.font = .systemFont(ofSize: 11, weight: .medium); status.textColor = .secondaryLabelColor

        [mark,title,subtitle,info,codex,claude,installButton,openButton,status].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; root.addSubview($0) }
        NSLayoutConstraint.activate([
            mark.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 34), mark.topAnchor.constraint(equalTo: root.topAnchor, constant: 30),
            title.leadingAnchor.constraint(equalTo: mark.trailingAnchor, constant: 10), title.centerYAnchor.constraint(equalTo: mark.centerYAnchor),
            subtitle.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 36), subtitle.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -36), subtitle.topAnchor.constraint(equalTo: mark.bottomAnchor, constant: 22),
            info.leadingAnchor.constraint(equalTo: subtitle.leadingAnchor), info.trailingAnchor.constraint(equalTo: subtitle.trailingAnchor), info.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 22),
            codex.leadingAnchor.constraint(equalTo: subtitle.leadingAnchor), codex.topAnchor.constraint(equalTo: info.bottomAnchor, constant: 22),
            claude.leadingAnchor.constraint(equalTo: codex.leadingAnchor), claude.topAnchor.constraint(equalTo: codex.bottomAnchor, constant: 10),
            installButton.leadingAnchor.constraint(equalTo: subtitle.leadingAnchor), installButton.widthAnchor.constraint(equalToConstant: 220), installButton.heightAnchor.constraint(equalToConstant: 38), installButton.topAnchor.constraint(equalTo: claude.bottomAnchor, constant: 24),
            openButton.leadingAnchor.constraint(equalTo: installButton.trailingAnchor, constant: 10), openButton.centerYAnchor.constraint(equalTo: installButton.centerYAnchor), openButton.heightAnchor.constraint(equalToConstant: 38),
            status.leadingAnchor.constraint(equalTo: subtitle.leadingAnchor), status.trailingAnchor.constraint(equalTo: subtitle.trailingAnchor), status.topAnchor.constraint(equalTo: installButton.bottomAnchor, constant: 16)
        ])
        window.makeKeyAndOrderFront(nil)
    }

    @objc private func install() {
        installButton.isEnabled = false; status.stringValue = "正在复制本地服务和技能…"
        let script = Bundle.main.resourceURL!.appendingPathComponent("install.sh")
        var args = [script.path]
        if codex.state == .on { args.append("codex") }
        if claude.state == .on { args.append("claude") }
        DispatchQueue.global(qos: .userInitiated).async {
            let process = Process(); process.executableURL = URL(fileURLWithPath: "/bin/zsh"); process.arguments = args
            let pipe = Pipe(); process.standardOutput = pipe; process.standardError = pipe
            do {
                try process.run(); process.waitUntilExit()
                let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                DispatchQueue.main.async {
                    if process.terminationStatus == 0 {
                        if let line = output.split(separator: "\n").first(where: { $0.hasPrefix("UGC_FLOW_URL=") }),
                           let url = URL(string: String(line.dropFirst("UGC_FLOW_URL=".count))) {
                            self.appURL = url
                        }
                        self.status.stringValue = "安装完成。服务已验证并在本机启动。"
                        self.status.textColor = .systemGreen; self.openButton.isHidden = false; self.installButton.title = "重新安装"; self.installButton.isEnabled = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { self.openApp() }
                    } else {
                        self.status.stringValue = "安装失败：\(output.trimmingCharacters(in: .whitespacesAndNewlines))"
                        self.status.textColor = .systemRed; self.installButton.isEnabled = true
                    }
                }
            } catch {
                DispatchQueue.main.async { self.status.stringValue = "安装失败：\(error.localizedDescription)"; self.status.textColor = .systemRed; self.installButton.isEnabled = true }
            }
        }
    }

    @objc private func openApp() { NSWorkspace.shared.open(appURL) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
