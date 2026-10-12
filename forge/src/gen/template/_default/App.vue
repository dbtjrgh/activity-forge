<script setup lang="ts">
import ActivityApp from "@_common/vueComponent/ActivityApp.vue";

import { SparkApp } from "@_common/sparkLib/Application";
import { Activity } from "./Activity";

async function _onInitApp() {
  await SparkApp.registActivity(new Activity());
}
</script>

<template>
  <ActivityApp @init="_onInitApp" />
</template>
