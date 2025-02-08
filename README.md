# **XState TypeScript Language Service Plugin**

Enhance your **TypeScript experience** when working with **XState state machines**! This **TypeScript TSServer plugin** improves **Go to Definition** and provides **better navigation for state machine configurations** inside your editor.

---

## **Features**

✅ **Enhances "Go to Definition" (`F12`)** to jump from a implementation to it's
definition within the setup block.

---

## **Installation**

You can install the plugin globally or per project.

### **📌 Project Installation**

To install the plugin per project, run:

```sh
`npm install --save-dev xstate-tsserver-plugin`
```

Then, modify your **`tsconfig.json`**:

```json
{ "compilerOptions": { "plugins": [{ "name": "xstate-tsserver-plugin" }] } }
```

Restart the TypeScript server (in VSCode by running **"TypeScript: Restart TS Server"** from the command palette)

### **📌 Global Installation**

TODO

---

## **Usage**

XState tsserver extends the regular tsserver definitions to make navigating
around a state machine much easier

### Go to Definition

Under any named action, guard or actor within the state machine config, going to
the definition will navigate to it's implementation within the setup block of
the machine.

In VSCode, hover over the implementation and press `F12` to navigate to the definition.

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
