Absolutely — here’s a **separate design-system + software architecture tree** you can hand to Codex as the master reference.

I’ve shaped it around the strongest patterns from established pixel tools and the feature gaps users repeatedly complain about: crisp pixel rendering, better palette workflows, stronger onion-skin controls, selection transforms, replace-color workflows, seamless tiling, and a scalable timeline/cel model. Those patterns are well documented across Aseprite, Pixelorama, and Piskel discussions/docs.

For the advanced layer, I’ve also structured this so it can later support 2D normal maps, material channels, dynamic lights, and open rigging/export paths that line up with Unity URP, Godot CanvasTexture workflows, Pixi lights/mesh rendering, and DragonBones-style data.

## Master software tree

```json
{
  "product": {
    "name": "PixelForge",
    "type": "nodejs_web_app",
    "positioning": "Professional pixel art + animation + rigging + material-lighting editor for games",
    "principles": [
      "pixel-perfect rendering first",
      "local-first by default",
      "fast command-driven UX",
      "modular workspace architecture",
      "design-token-based UI system",
      "smoke-test every critical path",
      "plugin-ready from day one",
      "never copy external code"
    ],
    "target_users": [
      "pixel artists",
      "indie game developers",
      "technical artists",
      "animators",
      "toolmakers"
    ]
  },

  "design_system": {
    "tokens": {
      "color": {
        "bg": {
          "app": "#0E0F12",
          "panel": "#151821",
          "panel_alt": "#1B1F2A",
          "canvas_backdrop": "#111111",
          "checker_a": "#2B2B2B",
          "checker_b": "#242424"
        },
        "text": {
          "primary": "#F5F7FA",
          "secondary": "#B7C0D1",
          "muted": "#7C879C",
          "disabled": "#566074",
          "inverse": "#0D1117"
        },
        "accent": {
          "primary": "#7C5CFF",
          "secondary": "#00C2FF",
          "success": "#37D67A",
          "warning": "#FFB020",
          "danger": "#FF5D73"
        },
        "canvas": {
          "grid": "rgba(255,255,255,0.08)",
          "pixel_grid": "rgba(255,255,255,0.06)",
          "selection": "#00C2FF",
          "selection_fill": "rgba(0,194,255,0.14)",
          "onion_prev": "rgba(255,80,80,0.34)",
          "onion_next": "rgba(80,140,255,0.34)",
          "guide": "rgba(124,92,255,0.35)"
        },
        "timeline": {
          "frame_idle": "#232938",
          "frame_active": "#33415C",
          "frame_selected": "#465A84",
          "tag_track": "#1A2030",
          "playhead": "#FFB020"
        },
        "status": {
          "ok": "#37D67A",
          "busy": "#00C2FF",
          "warn": "#FFB020",
          "error": "#FF5D73"
        }
      },

      "typography": {
        "font_family": {
          "ui": "Inter, system-ui, sans-serif",
          "mono": "JetBrains Mono, ui-monospace, monospace"
        },
        "font_size": {
          "xs": 11,
          "sm": 12,
          "md": 14,
          "lg": 16,
          "xl": 20
        },
        "font_weight": {
          "regular": 400,
          "medium": 500,
          "semibold": 600,
          "bold": 700
        },
        "line_height": {
          "tight": 1.1,
          "normal": 1.4
        }
      },

      "spacing": {
        "0": 0,
        "1": 4,
        "2": 8,
        "3": 12,
        "4": 16,
        "5": 20,
        "6": 24,
        "8": 32,
        "10": 40,
        "12": 48
      },

      "radius": {
        "none": 0,
        "sm": 4,
        "md": 8,
        "lg": 12
      },

      "shadow": {
        "panel": "0 10px 30px rgba(0,0,0,0.25)",
        "floating": "0 14px 40px rgba(0,0,0,0.35)",
        "focus": "0 0 0 2px rgba(0,194,255,0.6)"
      },

      "motion": {
        "fast": 120,
        "normal": 180,
        "slow": 260
      },

      "z_index": {
        "canvas": 1,
        "overlay": 10,
        "popover": 20,
        "modal": 30,
        "toast": 40,
        "command_palette": 50
      }
    },

    "layout_rules": {
      "app_shell": "topbar + left_tools + center_workspace + right_inspector + bottom_timeline",
      "panel_behavior": [
        "dockable",
        "resizable",
        "collapsible",
        "persisted_per_workspace"
      ],
      "density_modes": [
        "comfortable",
        "compact",
        "ultra_compact"
      ],
      "min_hit_target_px": 32,
      "supports_keyboard_only": true,
      "supports_pen_input": true
    },

    "components": {
      "primitives": [
        "Button",
        "IconButton",
        "ToggleButton",
        "SegmentedControl",
        "Tabs",
        "DropdownMenu",
        "ContextMenu",
        "Tooltip",
        "Popover",
        "Dialog",
        "Toast",
        "Badge",
        "Chip",
        "Divider",
        "Slider",
        "NumberInput",
        "TextInput",
        "SearchInput",
        "Checkbox",
        "Switch",
        "RadioGroup",
        "ProgressBar",
        "Spinner",
        "StatusDot"
      ],

      "layout": [
        "AppShell",
        "TopBar",
        "Sidebar",
        "InspectorPanel",
        "DockPanel",
        "SplitPane",
        "PanelTabs",
        "PanelSection",
        "PanelHeader",
        "WorkspaceViewport",
        "BottomTimelineDock"
      ],

      "editor_specific": [
        "ToolRail",
        "CanvasViewport",
        "CanvasMiniMap",
        "ZoomControl",
        "BrushPreview",
        "PixelGridToggle",
        "MirrorAxisControl",
        "PaletteGrid",
        "ColorPickerPopup",
        "LayerList",
        "LayerRow",
        "TimelineGrid",
        "TimelineFrameCell",
        "TimelineTagTrack",
        "OnionSkinControl",
        "PlaybackBar",
        "AnimationCurveEditor",
        "RigHierarchyTree",
        "BoneInspector",
        "MaterialChannelPanel",
        "LightRigPanel",
        "AssetBrowser",
        "ExportPresetCard",
        "ProjectSwitcher"
      ]
    }
  },

  "application": {
    "workspaces": {
      "draw": {
        "purpose": "pixel painting and tile editing",
        "panels": [
          "tool_rail",
          "canvas_viewport",
          "palette_panel",
          "layers_panel",
          "tool_options_panel",
          "history_panel"
        ],
        "tools": [
          "pencil",
          "erase",
          "bucket_fill",
          "color_picker",
          "replace_color",
          "line",
          "rectangle",
          "ellipse",
          "selection_rect",
          "selection_lasso",
          "selection_wand",
          "move",
          "transform",
          "dither",
          "shade",
          "stamp",
          "slice",
          "mirror_draw"
        ]
      },

      "animate": {
        "purpose": "frame-based animation and playback",
        "panels": [
          "timeline_grid",
          "frame_properties",
          "playback_controls",
          "onion_skin_controls",
          "tag_track",
          "audio_reference_panel"
        ],
        "tools": [
          "new_frame",
          "duplicate_frame",
          "link_cel",
          "frame_duration_edit",
          "frame_tagging",
          "timeline_scrub",
          "motion_preview"
        ]
      },

      "rig": {
        "purpose": "sprite cutout rigging and hybrid skeletal animation",
        "panels": [
          "rig_hierarchy",
          "bone_list",
          "bone_inspector",
          "attachment_binding_panel",
          "weight_paint_panel",
          "constraints_panel",
          "ik_panel",
          "pose_library"
        ],
        "tools": [
          "create_bone",
          "edit_bone",
          "bind_attachment",
          "assign_weights",
          "pivot_edit",
          "pose_mode",
          "mesh_edit_optional",
          "ik_target"
        ]
      },

      "materials_lighting": {
        "purpose": "material channels, normals, masks, and dynamic light preview",
        "panels": [
          "material_stack",
          "channel_editor",
          "normal_authoring",
          "mask_editor",
          "light_rig",
          "shader_preview",
          "engine_export_presets"
        ],
        "tools": [
          "paint_albedo",
          "paint_normal",
          "paint_emissive",
          "paint_mask",
          "light_place",
          "light_edit",
          "material_preview_toggle"
        ]
      },

      "export": {
        "purpose": "deliver to game engines and content pipelines",
        "panels": [
          "export_targets",
          "spritesheet_settings",
          "metadata_settings",
          "rig_export_settings",
          "lighting_export_settings",
          "batch_export_queue"
        ],
        "tools": [
          "export_png",
          "export_gif",
          "export_webp",
          "export_project_bundle",
          "export_unity_urp",
          "export_godot",
          "export_pixi",
          "export_dragonbones"
        ]
      }
    },

    "global_surfaces": {
      "top_bar": [
        "project_menu",
        "edit_menu",
        "view_menu",
        "select_menu",
        "animation_menu",
        "rig_menu",
        "materials_menu",
        "export_menu",
        "plugin_menu",
        "help_menu",
        "search_command_palette"
      ],
      "left_tool_rail": [
        "primary_tools",
        "secondary_tool_stack",
        "foreground_background_colors",
        "quick_swap",
        "recent_tools"
      ],
      "right_inspector": [
        "contextual_properties",
        "active_tool_options",
        "selection_info",
        "asset_metadata",
        "engine_preview_settings"
      ],
      "bottom_dock": [
        "timeline",
        "jobs",
        "console",
        "problems",
        "version_history"
      ]
    }
  },

  "domain_model": {
    "core_entities": {
      "Project": {
        "fields": [
          "id",
          "name",
          "version",
          "createdAt",
          "updatedAt",
          "canvas",
          "colorMode",
          "palettes",
          "layers",
          "frames",
          "cels",
          "tags",
          "materials",
          "rigs",
          "assets",
          "settings"
        ]
      },

      "Canvas": {
        "fields": [
          "width",
          "height",
          "tileMode",
          "backgroundMode",
          "pixelAspect",
          "grid"
        ]
      },

      "Palette": {
        "fields": [
          "id",
          "name",
          "colors",
          "source",
          "isLocked",
          "metadata"
        ]
      },

      "Layer": {
        "fields": [
          "id",
          "name",
          "type",
          "visible",
          "locked",
          "opacity",
          "blendMode",
          "parentId",
          "onionIgnore"
        ],
        "types": [
          "pixel",
          "group",
          "reference",
          "tilemap",
          "material_channel"
        ]
      },

      "Frame": {
        "fields": [
          "id",
          "durationMs",
          "label",
          "index"
        ]
      },

      "Cel": {
        "fields": [
          "id",
          "layerId",
          "frameId",
          "bitmapRef",
          "offsetX",
          "offsetY",
          "linked",
          "materialId"
        ]
      },

      "Tag": {
        "fields": [
          "id",
          "name",
          "color",
          "fromFrameId",
          "toFrameId",
          "playMode"
        ]
      },

      "Material": {
        "fields": [
          "id",
          "name",
          "albedoRef",
          "normalRef",
          "maskRef",
          "emissiveRef",
          "roughnessRef_optional",
          "shaderPreset"
        ]
      },

      "Rig": {
        "fields": [
          "id",
          "name",
          "bones",
          "attachments",
          "constraints",
          "animations",
          "meshData_optional"
        ]
      },

      "Bone": {
        "fields": [
          "id",
          "name",
          "parentId",
          "x",
          "y",
          "rotation",
          "scaleX",
          "scaleY",
          "length",
          "visible"
        ]
      },

      "Attachment": {
        "fields": [
          "id",
          "name",
          "layerId",
          "boneId",
          "pivot",
          "zOrder",
          "weights_optional"
        ]
      },

      "AnimationClip": {
        "fields": [
          "id",
          "name",
          "durationMs",
          "tracks",
          "loopMode"
        ]
      },

      "Light": {
        "fields": [
          "id",
          "type",
          "x",
          "y",
          "z",
          "radius",
          "intensity",
          "color",
          "falloff",
          "castsShadows_optional"
        ]
      }
    }
  },

  "systems": {
    "rendering_system": {
      "goal": "crisp editing + high-performance preview + shader-based advanced lighting",
      "subsystems": {
        "editor_renderer_2d": {
          "responsibility": "nearest-neighbor pixel editing surface",
          "features": [
            "pixel-perfect zoom",
            "grid overlay",
            "selection overlay",
            "marquee animation",
            "dirty-rect redraw"
          ]
        },
        "gpu_preview_renderer": {
          "responsibility": "materials, normals, dynamic lights, rig preview",
          "features": [
            "offscreen composition",
            "shader passes",
            "normal map lighting",
            "palette-aware preview",
            "engine target preview"
          ]
        },
        "compositor": {
          "responsibility": "merge layers, onion skins, selection masks, effects",
          "passes": [
            "base_layers",
            "onion_skin_prev",
            "onion_skin_next",
            "selection",
            "guides",
            "tool_overlay",
            "lighting_preview_optional"
          ]
        },
        "cache_manager": {
          "responsibility": "offscreen caches and atlas pages",
          "stores": [
            "cel_bitmap_cache",
            "frame_composite_cache",
            "onion_composite_cache",
            "material_channel_cache",
            "thumbnail_cache"
          ]
        }
      }
    },

    "input_system": {
      "responsibility": "mouse, pen, touch, keyboard, gestures",
      "supports": [
        "pointer_capture",
        "pressure_optional",
        "tilt_optional",
        "keyboard_shortcuts",
        "command_palette",
        "marquee_multi_select"
      ]
    },

    "command_system": {
      "responsibility": "all actions become deterministic commands",
      "features": [
        "undo_redo",
        "command_replay",
        "macro_recording_optional",
        "action_registry",
        "shortcut_binding",
        "command_palette_search"
      ],
      "command_examples": [
        "DRAW_STROKE",
        "ERASE_STROKE",
        "FILL_REGION",
        "REPLACE_COLOR",
        "MOVE_SELECTION",
        "TRANSFORM_SELECTION",
        "ADD_FRAME",
        "SET_FRAME_DURATION",
        "TOGGLE_LAYER_VISIBILITY",
        "CREATE_BONE",
        "BIND_ATTACHMENT",
        "EXPORT_PROJECT"
      ]
    },

    "document_system": {
      "responsibility": "authoritative project state",
      "features": [
        "schema_versioning",
        "migration_pipeline",
        "sparse_cel_storage",
        "binary_asset_references",
        "local autosave",
        "recovery_snapshots"
      ]
    },

    "animation_system": {
      "responsibility": "frame animation, timeline, onion skinning, tags",
      "features": [
        "frame_durations",
        "play_modes",
        "tag_tracks",
        "onion_skin_ranges",
        "onion_skin_tinting",
        "draw_while_playing"
      ]
    },

    "palette_system": {
      "responsibility": "palette storage, editing, import, remap, indexed workflows",
      "features": [
        "project_palettes",
        "user_palettes",
        "lospec_import",
        "palette_extraction_from_image",
        "palette_locking",
        "reindex_project",
        "global_color_replace"
      ]
    },

    "tile_system": {
      "responsibility": "seamless textures and tile workflows",
      "features": [
        "wrap_preview",
        "offset_wrap",
        "draw_in_tiled_area",
        "tilemap_layers_optional",
        "pattern_stamp"
      ]
    },

    "rig_system": {
      "responsibility": "2d cutout rigging and hybrid sprite deformation",
      "features": [
        "bone_hierarchy",
        "pivot_management",
        "attachment_binding",
        "constraints",
        "ik_optional",
        "weight_paint_optional",
        "pose_library"
      ]
    },

    "materials_system": {
      "responsibility": "channel-based material authoring",
      "channels": [
        "albedo",
        "normal",
        "mask",
        "emissive",
        "specular_optional",
        "roughness_optional"
      ]
    },

    "lighting_system": {
      "responsibility": "2d per-pixel lighting preview",
      "features": [
        "point_lights",
        "directional_lights",
        "ambient_light",
        "normal_strength",
        "palette_preserving_mode",
        "preview_presets"
      ]
    },

    "asset_system": {
      "responsibility": "bitmaps, spritesheets, imported files, generated previews",
      "features": [
        "asset_registry",
        "hashing",
        "thumbnailing",
        "deduplication",
        "lazy_loading"
      ]
    },

    "plugin_system": {
      "responsibility": "safe future extensibility",
      "extension_points": [
        "tools",
        "importers",
        "exporters",
        "filters",
        "palette_sources",
        "workspace_panels",
        "commands",
        "shader_presets"
      ]
    }
  },

  "features": {
    "must_have": [
      "pixel-perfect zoom and rendering",
      "paint",
      "erase",
      "color picker",
      "bucket fill",
      "replace one color with another",
      "palette import/export",
      "onion skinning",
      "frame timeline",
      "layers",
      "selection transforms",
      "seamless wrap preview",
      "offset wrap",
      "spritesheet export",
      "undo redo",
      "autosave",
      "design tokens"
    ],
    "should_have": [
      "indexed color mode",
      "dither brush",
      "shade tool",
      "frame tags",
      "audio reference",
      "command palette",
      "plugin system",
      "engine export presets"
    ],
    "advanced": [
      "bone rigging",
      "hybrid frame + rig animation",
      "materials panel",
      "normal authoring",
      "dynamic lighting preview",
      "dragonbones export",
      "collaboration readiness"
    ]
  },

  "folder_structure": {
    "root": {
      "apps": {
        "web": {
          "src": {
            "app": {},
            "routes": {},
            "providers": {},
            "styles": {},
            "boot": {}
          }
        },
        "server": {
          "src": {
            "api": {},
            "jobs": {},
            "storage": {},
            "auth": {},
            "config": {}
          }
        }
      },

      "packages": {
        "design-system": {
          "src": {
            "tokens": {},
            "themes": {},
            "components": {
              "primitives": {},
              "layout": {},
              "editor": {}
            },
            "icons": {},
            "utils": {}
          }
        },

        "domain": {
          "src": {
            "entities": {},
            "schemas": {},
            "migrations": {},
            "commands": {},
            "events": {},
            "selectors": {}
          }
        },

        "engine": {
          "src": {
            "rendering": {
              "canvas2d": {},
              "gpu": {},
              "compositor": {},
              "cache": {}
            },
            "tools": {},
            "selection": {},
            "palette": {},
            "animation": {},
            "tile": {},
            "materials": {},
            "lighting": {},
            "rig": {},
            "export": {},
            "import": {}
          }
        },

        "state": {
          "src": {
            "stores": {},
            "actions": {},
            "history": {},
            "persistence": {},
            "sync_optional": {}
          }
        },

        "workers": {
          "src": {
            "fill.worker": {},
            "replace-color.worker": {},
            "quantize.worker": {},
            "atlas-pack.worker": {},
            "thumbnail.worker": {},
            "export.worker": {}
          }
        },

        "plugins": {
          "src": {
            "runtime": {},
            "manifest": {},
            "sandbox": {},
            "registry": {}
          }
        },

        "io": {
          "src": {
            "project-format": {},
            "png": {},
            "gif": {},
            "webp": {},
            "aseprite-json-import": {},
            "lospec": {},
            "dragonbones": {},
            "unity-urp": {},
            "godot": {},
            "pixi": {}
          }
        },

        "testing": {
          "src": {
            "fixtures": {},
            "goldens": {},
            "render-hash": {},
            "playwright": {},
            "smoke": {},
            "unit": {}
          }
        }
      }
    }
  },

  "ui_tree": {
    "AppShell": {
      "TopBar": {
        "children": [
          "ProjectMenu",
          "EditMenu",
          "ViewMenu",
          "AnimationMenu",
          "RigMenu",
          "MaterialsMenu",
          "ExportMenu",
          "PluginMenu",
          "SearchCommandPalette"
        ]
      },
      "LeftToolRail": {
        "children": [
          "ToolGroup.Draw",
          "ToolGroup.Select",
          "ToolGroup.Transform",
          "ToolGroup.Color",
          "QuickFG_BGSwap",
          "RecentTools"
        ]
      },
      "CenterWorkspace": {
        "children": [
          "WorkspaceTabs",
          "CanvasViewport",
          "Overlay.Guides",
          "Overlay.Selection",
          "Overlay.OnionSkin",
          "Overlay.LightPreview"
        ]
      },
      "RightInspector": {
        "children": [
          "ToolOptionsPanel",
          "PalettePanel",
          "LayerPanel",
          "PropertiesPanel",
          "AssetPanel"
        ]
      },
      "BottomDock": {
        "children": [
          "TimelinePanel",
          "PlaybackBar",
          "JobsPanel",
          "ConsolePanel",
          "ProblemsPanel"
        ]
      }
    }
  },

  "project_file_format": {
    "format_name": "pixelforge.project.json",
    "versioning": {
      "field": "schemaVersion",
      "policy": "forward_migration_required",
      "strategy": [
        "open file",
        "detect version",
        "run migration chain",
        "validate final schema",
        "write upgraded recovery snapshot"
      ]
    },
    "binary_assets": {
      "stored_as": "separate blobs",
      "referenced_by": "assetId",
      "hashing": "content_hash"
    }
  },

  "api_surface": {
    "client_only_capable": true,
    "optional_node_backend": {
      "routes": [
        "POST /projects",
        "GET /projects/:id",
        "PATCH /projects/:id",
        "POST /projects/:id/export",
        "POST /projects/:id/import",
        "GET /palettes/lospec/:slug",
        "POST /assets/upload",
        "GET /assets/:id",
        "POST /plugins/install"
      ]
    }
  },

  "quality": {
    "smoke_tests": [
      "app boots with no runtime errors",
      "new project opens",
      "one pixel can be drawn and erased",
      "replace-color works on exact match",
      "timeline can add and play frames",
      "onion skin renders prev and next",
      "tile wrap preview shows 3x3 repeat",
      "export png spritesheet succeeds",
      "rig workspace can create 2 bones",
      "lighting preview can place 1 point light"
    ],
    "visual_regression": [
      "canvas crisp zoom",
      "timeline frame states",
      "onion tint colors",
      "palette grid layout",
      "material preview card"
    ],
    "golden_output_tests": [
      "frame composite hash",
      "spritesheet export hash",
      "normal map channel pack hash",
      "dragonbones json schema validation"
    ]
  },

  "codex_execution_order": [
    {
      "phase": "01_foundation",
      "deliver": [
        "monorepo",
        "design tokens",
        "app shell",
        "command system",
        "project schema",
        "smoke test harness"
      ]
    },
    {
      "phase": "02_draw_core",
      "deliver": [
        "canvas viewport",
        "paint erase picker fill",
        "layers",
        "palette panel",
        "undo redo"
      ]
    },
    {
      "phase": "03_animation",
      "deliver": [
        "timeline",
        "frames cels",
        "onion skin",
        "tag track",
        "playback"
      ]
    },
    {
      "phase": "04_texture_productivity",
      "deliver": [
        "wrap preview",
        "offset wrap",
        "replace color",
        "selection transforms",
        "dither and shade"
      ]
    },
    {
      "phase": "05_materials_lighting",
      "deliver": [
        "material channels",
        "normal preview",
        "light rig",
        "shader preview"
      ]
    },
    {
      "phase": "06_rigging",
      "deliver": [
        "bone system",
        "attachments",
        "pose mode",
        "clip tracks",
        "dragonbones export"
      ]
    },
    {
      "phase": "07_plugins_exports_polish",
      "deliver": [
        "plugin runtime",
        "engine export presets",
        "asset browser",
        "project recovery",
        "docs"
      ]
    }
  ]
}
```

## How Codex should use this

🟣 **This JSON should act as the single source of truth** for:

* folder generation
* package/module boundaries
* component naming
* store naming
* domain schema creation
* smoke test scaffolding
* roadmap sequencing

🔵 The safest implementation path is:

1. scaffold `design-system`, `domain`, `engine`, `state`, `workers`, `io`
2. boot the app shell
3. make draw-core work before any fancy rendering
4. add timeline/onion next
5. add materials/lighting only after compositing is solid
6. add rigging after export/data model is stable

## My recommendation for Codex prompt handoff

Use this as the opening instruction:

```text
Use the attached master JSON architecture tree as the source of truth.
Scaffold a monorepo Node.js web application for a pixel art editor called PixelForge.

Rules:
- Never copy external code verbatim.
- Follow the package/folder/component names from the JSON.
- Implement in phases matching codex_execution_order.
- Start with app shell, design tokens, project schema, command system, and smoke tests.
- Ensure pixel-perfect nearest-neighbor rendering.
- All major actions must be command-based for undo/redo.
- Add smoke tests for every phase before moving on.
- Keep the system plugin-ready and schema-versioned.
```

## Strong next step

I can turn this into **an even stricter Codex handoff pack** with:

* `architecture.json`
* `repo-tree.json`
* `component-spec.json`
* `milestones.json`
* `smoketests.json`

all split cleanly so you can paste them one by one.
