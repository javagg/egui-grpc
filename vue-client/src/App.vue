<template>
  <div v-if="IS_LOCAL_FIRST" class="mode-ribbon" data-testid="mode-ribbon">LOCAL FIRST</div>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from "vue-router";
import { IS_LOCAL_FIRST } from "./runtimeMode";
</script>
