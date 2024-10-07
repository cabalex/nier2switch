<script lang="ts">
  import convert from "./lib/convert";

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    let arrayBuffer = await convert(file);

    // download
    const blob = new Blob([arrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.zip$/, "-switch.zip");
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<main>
  <input type="file" accept=".zip" on:change={handleFileSelect} />
</main>

<style>

</style>