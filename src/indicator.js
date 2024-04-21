import Gio from "gi://Gio";
import GObject from "gi://GObject";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import { spawnCommandLine } from "resource:///org/gnome/shell/misc/util.js";

const statusPattern = /(Connected|Connecting|Disconnecting|Disconnected|Registration Missing)/;

const MullvadStatus = Object.freeze({
  Connected: "Connected",
  Connecting: "Connecting",
  Disconnecting: "Disconnecting",
  Disconnected: "Disconnected",
  "Registration Missing": "Registration Missing",
  Error: "Error",
});

const MullvadToggle = GObject.registerClass(
  class MullvadToggle extends QuickSettings.QuickToggle {
    _init(extensionObject) {
      super._init({
        title: "Mullvad VPN",
        gicon: Gio.icon_new_for_string(
          'network-vpn-symbolic'
        ),
      });
    }
  }
);

export var MullvadIndicator = GObject.registerClass(
  class MullvadIndicator extends QuickSettings.SystemIndicator {
    _init(extensionObject) {
      super._init();
      this._indicator = this._addIndicator();
      this._settings = extensionObject.getSettings();
      this._indicator.visible = true;
      this._indicator.gicon = Gio.icon_new_for_string(
        'network-vpn-symbolic'
      );

      // Create a Toggle for QuickSettings
      this._toggle = new MullvadToggle(extensionObject);
      this._toggle.connect("clicked", async () => {
        if ((await this.checkStatus()) == MullvadStatus.Connecting) return;
        if ((await this.checkStatus()) == MullvadStatus.Disconnecting) return;
        spawnCommandLine(
          `mullvad ${!this._toggle.checked ? "connect" : "disconnect"}`
        );
        await this.checkStatus();
        this.probeManualConnectionStatus();
      });
    }

    async probeManualConnectionStatus() {
      const status = await this.checkStatus();
      if (status == MullvadStatus.Connecting) this.probeManualConnectionStatus();
      if (status == MullvadStatus.Disconnecting) this.probeManualConnectionStatus();
    }

    destroy() {
      this._settings = null;
      if (this._manualStatusCheck) clearTimeout(this._manualStatusCheck);
      this._manualStatusCheck = null;
      this._indicator.destroy();
      super.destroy();
    }

    updateStatus(isActive, optionalStatus) {
      this._toggle.set({ checked: isActive, subtitle: optionalStatus });
    }

    async checkStatus() {
      try {
        const proc = Gio.Subprocess.new(
          ["mullvad", "status"],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        const stdout = await new Promise((resolve, reject) => {
          proc.communicate_utf8_async(null, null, (proc, res) => {
            let [, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (proc.get_successful()) resolve(stdout);
            reject(stderr);
          });
        });

        const status = statusPattern.exec(stdout)?.[1];

        if (status.includes("Connecting")) {
          this.updateStatus(false, `Connecting`);
          this._indicator.gicon = Gio.icon_new_for_string(
            'network-vpn-acquiring-symbolic'
          );
        } else if (status.includes("Disconnecting")) {
          this.updateStatus(true, 'Disconnecting');
          this._indicator.gicon = Gio.icon_new_for_string(
            'network-vpn-acquiring-symbolic'
          );
        } else if (status.includes('Connected')) {
          this.updateStatus(true, `Connected`);
          this._indicator.gicon = Gio.icon_new_for_string(
            'network-vpn-symbolic'
          );
        } else {
          this.updateStatus(false, "Disconnected");
          this._indicator.gicon = Gio.icon_new_for_string(
            'network-vpn-disabled-symbolic'
          );
        }

        return MullvadStatus[status];
      } catch (err) {
        this.updateStatus(false, MullvadStatus.Error);
        logError(err);
        return MullvadStatus.Error;
      }
    }
  }
);