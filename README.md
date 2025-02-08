# **XState TypeScript Language Service Plugin**

Enhance your **TypeScript experience** when working with **XState state machines**!
This **TypeScript TSServer plugin** provides **better navigation for state machine configurations** inside your IDE.

---

## **Features**

✅ **Go to Definition (`F12`/`gd`)** to jump from a given action, guard, actor, or delay to its definition within the setup block of a machine.

### Coming soon

🛠️ **Find all references (`Shift+F12`/`gr`)** to list implementations of a given action, guard, actor, or delay.
🛠️ **Show implementation on hover** of the given implementation of a given action, guard, actor, or delay.
🛠️ **Jump to state target**

---

## **Installation**

You can install the plugin globally or per project.

### **📌 Project Installation**

To install the plugin in your project, simply run:

```sh
npm install --save-dev xstate-tsserver
```

### **📌 Global Installation**

You can also install the plugin globally by running:

```sh
npm install -g xstate-tsserver
```

You will also need to add your global node_modules path to tsserver's plugin paths.

For example, in VSCode, you can edit your **`settings.json`** to add the plugin path:

```json
{
  "typescript.tsserver.pluginPaths": ["path/to/global/node_modules"]
}
```

💡 **Tip:** You can find your global node_modules path by running:

```sh
npm root -g
```

### Plugin activation

Modify your **`tsconfig.json`** to include the plugin:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "xstate-tsserver" }]
  }
}
```

Restart the TypeScript server (in VSCode by running **"TypeScript: Restart TS Server"** from the command palette)

TODO: find a way to activate the plugin globally

---

## **Usage**

XState tsserver extends the regular tsserver definitions to make navigating
around a state machine much easier

### Go to Definition

Under any named action, guard or actor within the state machine config, going to
the definition will navigate to it's implementation within the setup block of
the machine.

In VSCode, hover over the implementation and press `F12` or `cmd+click` to navigate to the definition.

---

## Troubleshooting

💡 **Tip:** Open **TS Server Logs** (`"TypeScript: Open TS Server Logs"`) to verify that the plugin is loaded.
You should see this log line `xstate tsserver loaded`

---

## **Contributing**

Contributions are welcome! 🚀 If you find any issues or have ideas to improve the plugin, feel free to:

- **Submit an issue** on GitHub.
- **Open a pull request** with improvements.

---

## **Resources**

- [TypeScript Language Service Plugin Docs](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#overview-writing-a-simple-plugin)
- [XState Documentation](https://stately.ai/docs)

---

## **License**

MIT License. 📝
