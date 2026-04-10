---
permalink: /assets/js/search-data.js
---
// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [
  {%- for page in site.pages -%}
    {%- if page.permalink == '/' -%}{%- assign about_title = page.title | strip -%}{%- endif -%}
  {%- endfor -%}
  {
    id: "nav-{{ about_title | slugify }}",
    title: "{{ about_title | truncatewords: 13 }}",
    section: "Navigation",
    handler: () => {
      window.location.href = "{{ '/' | relative_url }}";
    },
  },
  {%- assign sorted_pages = site.pages | sort: "nav_order" -%}
  {%- for p in sorted_pages -%}
    {%- if p.nav and p.autogen == null -%}
      {%- if p.dropdown -%}
        {%- for child in p.children -%}
          {%- unless child.title == 'divider' -%}
            {
              {%- assign title = child.title | escape | strip -%}
              {%- if child.permalink contains "/blog/" -%}{%- assign url = "/blog/" -%} {%- else -%}{%- assign url = child.permalink -%}{%- endif -%}
              id: "dropdown-{{ title | slugify }}",
              title: "{{ title | truncatewords: 13 }}",
              description: "{{ child.description | strip_html | strip_newlines | escape | strip }}",
              section: "Dropdown",
              handler: () => {
                window.location.href = "{{ url | relative_url }}";
              },
            },
          {%- endunless -%}
        {%- endfor -%}

      {%- else -%}
        {
          {%- assign title = p.title | escape | strip -%}
          {%- if p.permalink contains "/blog/" -%}{%- assign url = "/blog/" -%} {%- else -%}{%- assign url = p.url -%}{%- endif -%}
          id: "nav-{{ title | slugify }}",
          title: "{{ title | truncatewords: 13 }}",
          description: "{{ p.description | strip_html | strip_newlines | escape | strip }}",
          section: "Navigation",
          handler: () => {
            window.location.href = "{{ url | relative_url }}";
          },
        },
      {%- endif -%}
    {%- endif -%}
  {%- endfor -%}
  {%- for collection in site.collections -%}
    {%- if collection.label != 'posts' and collection.label != 'teachings' and collection.label != 'books' and collection.label != 'themes' and collection.label != 'news' -%}
      {%- for item in collection.docs -%}
        {
          {%- if item.inline -%}
            {%- assign title = item.content | newline_to_br | replace: "<br />", " " | replace: "<br/>", " " | strip_html | strip_newlines | escape | strip -%}
          {%- else -%}
            {%- assign title = item.title | newline_to_br | replace: "<br />", " " | replace: "<br/>", " " | strip_html | strip_newlines | escape | strip -%}
          {%- endif -%}
          id: "{{ collection.label }}-{{ title | slugify }}",
          title: '{{ title | escape | emojify | truncatewords: 13 }}',
          description: "{{ item.description | strip_html | strip_newlines | escape | strip }}",
          {%- if collection.label == 'projects' -%}
            section: "Mods",
          {%- else -%}
            section: "{{ collection.label | capitalize }}",
          {%- endif -%}
          {%- unless item.inline -%}
            handler: () => {
              window.location.href = "{{ item.url | relative_url }}";
            },
          {%- endunless -%}
        },
      {%- endfor -%}
    {%- endif -%}
  {%- endfor -%}
];
