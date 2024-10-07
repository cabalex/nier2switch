<script lang="ts">
  import convert from "./lib/convert";

  let inputElem: HTMLInputElement;
  let loading = false;
  let error: any|null = null;
  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    loading = true;

    let arrayBuffer = await convert(file).catch(e => error = e);

    if (error) {
      console.error(error);
      loading = false;
      inputElem.value = "";
      return;
    }

    // download
    const blob = new Blob([arrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.zip$/, "-switch.zip");
    a.click();
    URL.revokeObjectURL(url);
    inputElem.value = "";

    loading = false;
  }
</script>

<main>
  <input bind:this={inputElem} style="display: none;" type="file" accept=".zip" on:change={handleFileSelect} />
  <h1>NieR2Switch</h1>
  <p>Convert NieR mods to the Nintendo Switch version.</p>
  <button disabled={loading} on:click={() => inputElem.click()}>
    Select a mod .zip file
  </button>
  {#if loading}
    <p>Converting...</p>
  {/if}
  {#if error}
    <p style="color: red;">An error occurred during conversion:<br>{error.message}</p>
  {/if}
  <div class="alert">
    This converter probably won't work for certain folders, like font/ or core/. This is because these files require ASTC textures to be loaded, which the PC version does not use. I'm looking into this, but I can't guarantee a fix.
  </div>
</main>

<footer>
  <a href="https://cabalex.github.io/" target="_blank">cabalex.github.io</a>
  (<a href="https://github.com/cabalex/nier2switch" target="_blank">view source</a>)<br>
  Need help? Join the <a href="https://discord.gg/ngAK7rT" target="_blank">NieR Modding Discord</a>
</footer>

<style>
  .alert {
    border: 1px solid orange;
    border-radius: 5px;
    background-color: rgba(255, 165, 0, 0.1);
    padding: 10px;
    margin-top: 10px;
  }
  footer {
    position: fixed;
    bottom: 50px;
    width: 100%;
    left: 0;

  }
</style>