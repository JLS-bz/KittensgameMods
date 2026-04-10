---
layout: page
title: mods
permalink: /mods/
description: A growing collection of quality-of-life and automation scripts for Kittens Game.
nav: true
nav_order: 2
display_categories: [work, fun]
---

<!-- pages/projects.md - Mods Listing View -->
<div class="mods-container">
  {% if site.enable_project_categories and page.display_categories %}
    <!-- Display categorized mods -->
    {% for category in page.display_categories %}
    <div class="mod-category">
      <a id="{{ category }}" href=".#{{ category }}">
        <h2 class="category">{{ category }}</h2>
      </a>
      {% assign categorized_projects = site.projects | where: "category", category %}
      {% assign sorted_projects = categorized_projects | sort: "importance" %}
      
      <!-- Mod listings -->
      <div class="mod-listings">
        {% for project in sorted_projects %}
          {% include mod_listing.liquid %}
        {% endfor %}
      </div>
    </div>
    {% endfor %}
  {% else %}
    <!-- Display mods without categories -->
    {% assign sorted_projects = site.projects | sort: "importance" %}
    <div class="mod-listings">
      {% for project in sorted_projects %}
        {% include mod_listing.liquid %}
      {% endfor %}
    </div>
  {% endif %}
</div>
