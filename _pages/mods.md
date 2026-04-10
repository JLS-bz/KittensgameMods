---
layout: page
title: mods
permalink: /mods/
description: 
nav: true
nav_order: 2
---

<!-- pages/mods.md - Mods Listing View -->
<div class="mods-container">
  <!-- Display mods without categories -->
  {% assign sorted_mods = site.mods | sort: "importance" %}
  <div class="mod-listings">
    {% for mod in sorted_mods %}
      {% include mod_listing.liquid %}
    {% endfor %}
  </div>
</div>

{% include mod_download_handler.liquid %}
