<script lang="ts">
  import { goto } from '$app/navigation'
  import { auth } from '$lib/auth.svelte'

  // Точка входа: раскидываем по кабинетам в зависимости от того, кто вошёл.
  $effect(() => {
    void auth.ensure().then((profile) => {
      if (!profile) {
        return goto('/login', { replaceState: true })
      }
      if (profile.setupStep !== 'done') {
        return goto('/setup', { replaceState: true })
      }
      return goto(profile.role === 'ADMIN' ? '/admin' : '/dashboard', { replaceState: true })
    })
  })
</script>

<div class="min-h-screen flex items-center justify-center bg-bg">
  <div class="w-10 h-1 bg-accent animate-pulse"></div>
</div>
