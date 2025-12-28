/* 
   -------------------------------------------------------------------------
   Raptor Todo Hub Card - by Inter-Raptor (Vivien Jardot)
   -------------------------------------------------------------------------
   Custom Lovelace card for Home Assistant.

   Multi-list todo hub:
   - One card, multiple todo.* lists (grocery, home, personal tasks, etc.)
   - Category presets: grocery / urgency / rooms / timeframe
   - Category chips under the input field (auto-tagging with short labels)
   - Optional default_category per list

   Visual & UX:
   - Tabs for each list, with:
     - Progress bar (done / total) and color by percentage
     - Color mode per list: "category" or "urgency_age"
     - Tab color mode: progress | severity | mixed
   - Active tab is highlighted (thicker border + shadow)
   - Category pills on each task (label + color)

   Smart behaviour:
   - Auto-remove completed tasks after a per-list delay
     -> Delay & start time are stored in the item summary via tag:
        #rtrm(start,delay)
     -> Works across HA restarts / reloads / other devices
   - Long-press on an item:
     -> Confirmation dialog
     -> Manual deletion if confirmed
   - Click on the icon:
     -> Toggle between active / completed

   Internationalization:
   - Built-in labels for EN / FR / DE / ES
   - Presets are localized (category names per language)
   - language: "en" | "fr" | "de" | "es" (default: "en")
   - NOTE: we also accept "languages" for backward compatibility.
   Typical Lovelace usage:

   type: custom:raptor-todo-hub-card
   language: fr
   title: Tâches & courses – Démo
   title_mode: per_list
   lists:
     # 1) Grocery list with presets "grocery"
     - entity: todo.courses_demo
       label: Courses démo
       icon: mdi:cart
       preset: grocery
       default_category: fruits_legumes
       color_mode: category
       tab_color_mode: progress
       show_progress_bar: true
       auto_remove_completed_seconds: 86400

     # 2) Personal / admin tasks with urgency mode
     - entity: todo.taches_myriam_demo
       label: Tâches Myriam démo
       icon: mdi:account-heart
       preset: urgency
       color_mode: urgency_age
       tab_color_mode: mixed
       show_progress_bar: true
       auto_remove_completed_seconds: 0
       urgency_warning_color: "#f97316"
       urgency_overdue_color: "#ef4444"

     # 3) House chores by room
     - entity: todo.maison_demo
       label: Maison démo
       icon: mdi:home-wrench
       preset: rooms
       color_mode: category
       tab_color_mode: mixed
       show_progress_bar: false
       auto_remove_completed_seconds: 0

   Author  : Inter-Raptor (Vivien Jardot)
   Version : 1.0.0
   -------------------------------------------------------------------------
*/

/* "Raptor" ASCII logo ---------------------------------------------------- */
//                                   .,.                                          
//                       *******                        *#### (#####              
//                  ******                          / ########     .#####.        
//              ,*****                          //////##########   #####  /####   
//           .*****                           // /////*#####################  ##  
//         ******                             //// /// ######*      *############ 
//       ******                               ////// /   ###########,            
//     .*****                                 ////////     ##################     
//    ******                                  //////// #                         
//   *****.                                  ## ////// ###                       
//  *****,                              #########/ /// #####/                  , 
// ,*****                           ################ /.######                  
// *****                       (####################   (#####                  
// ******                   #####   ########   ////////   ###                   .*
//,******             .*** ######### #####*   /////////     # /                 *
// *********    .******* ############ ###### ////////       ////                *
//  ******************* (############# #####///////      *///// ##              *
//   ****************** //// ,######### ###  /########       #########          *
//     ****************  ////////  #####/(       #######.          ####         *
//                       /////// /////  ##     //    (####           ###       **
//                        ///// //////////, /////     .####       /*(##       **
//                       ////// ///////    / ////   ## ###         ,         ,**
//                     ////////////       // ///      #                     ***.
//    .              /////////,         ////,/                             ***   
//                   ///               ......                            ****    
//       ,           ,///##              /////                         ****.     
//         *.         // ###              ,/// /                     *****       
//           ,*       / ####                /*/// ///             *****          
//              **,    ####( ####             ///// ///        ******            
//                 ****  ##### #####                      ,*******               
//                     ******.                      **********                   
//                           ***************************                         

// ---- Raptor Todo Hub Card - multi-list todo hub (grocery / tasks / rooms) ----




const LovelaceView =
  customElements.get("hui-masonry-view") || customElements.get("hui-view");
const LitElementBase = LovelaceView
  ? Object.getPrototypeOf(LovelaceView)
  : HTMLElement;

const html = LitElementBase.prototype.html;
const css = LitElementBase.prototype.css;

// Tag de suppression auto stocké dans le summary : #rtrm(start,delay)
const AUTO_REMOVE_TAG_REGEX = /#rtrm\((\d+),(\d+)\)/;

// Presets intégrés
const RAPTOR_TODO_PRESETS = {
  // ----- COURSES : ~20 RAYONS -----
  grocery: [
    {
      key: "fruits_legumes",
      match: "#fruits",
      labels: {
        en: "Fruit & vegetables",
        fr: "Fruits & légumes",
        de: "Obst & Gemüse",
        es: "Frutas y verduras",
      },
      icon: "mdi:fruit-watermelon",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "frais",
      match: "#frais",
      labels: {
        en: "Chilled / Fresh",
        fr: "Frais",
        de: "Frische Produkte",
        es: "Frescos",
      },
      icon: "mdi:food-apple",
      color_off: "#9ca3af",
      color_on: "#4ade80",
    },
    {
      key: "surgeles",
      match: "#surg",
      labels: {
        en: "Frozen",
        fr: "Surgelés",
        de: "Tiefkühl",
        es: "Congelados",
      },
      icon: "mdi:snowflake",
      color_off: "#9ca3af",
      color_on: "#0ea5e9",
    },
    {
      key: "boucherie",
      match: "#bouch",
      labels: {
        en: "Butchery",
        fr: "Boucherie",
        de: "Metzgerei",
        es: "Carnicería",
      },
      icon: "mdi:food-steak",
      color_off: "#9ca3af",
      color_on: "#f97316",
    },
    {
      key: "poissonnerie",
      match: "#poiss",
      labels: {
        en: "Fish",
        fr: "Poissonnerie",
        de: "Fisch",
        es: "Pescadería",
      },
      icon: "mdi:fish",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "boulangerie",
      match: "#boul",
      labels: {
        en: "Bakery",
        fr: "Boulangerie",
        de: "Bäckerei",
        es: "Panadería",
      },
      icon: "mdi:bread-slice",
      color_off: "#9ca3af",
      color_on: "#eab308",
    },
    {
      key: "epicerie_salee",
      match: "#epis",
      labels: {
        en: "Savory grocery",
        fr: "Épicerie salée",
        de: "Herzhafte Lebensmittel",
        es: "Ultramarinos salados",
      },
      icon: "mdi:food-variant",
      color_off: "#9ca3af",
      color_on: "#f97316",
    },
    {
      key: "epicerie_sucree",
      match: "#epid",
      labels: {
        en: "Sweet grocery",
        fr: "Épicerie sucrée",
        de: "Süße Lebensmittel",
        es: "Ultramarinos dulces",
      },
      icon: "mdi:candy",
      color_off: "#9ca3af",
      color_on: "#a855f7",
    },
    {
      key: "pates_riz",
      match: "#pates",
      labels: {
        en: "Pasta & rice",
        fr: "Pâtes / Riz",
        de: "Nudeln & Reis",
        es: "Pasta y arroz",
      },
      icon: "mdi:noodles",
      color_off: "#9ca3af",
      color_on: "#facc15",
    },
    {
      key: "conserves",
      match: "#cons",
      labels: {
        en: "Canned food",
        fr: "Conserves",
        de: "Konserven",
        es: "Conservas",
      },
      icon: "mdi:food-can",
      color_off: "#9ca3af",
      color_on: "#f97316",
    },
    {
      key: "boissons",
      match: "#boiss",
      labels: {
        en: "Drinks",
        fr: "Boissons",
        de: "Getränke",
        es: "Bebidas",
      },
      icon: "mdi:bottle-soda",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "eau",
      match: "#eau",
      labels: {
        en: "Water",
        fr: "Eau",
        de: "Wasser",
        es: "Agua",
      },
      icon: "mdi:cup-water",
      color_off: "#9ca3af",
      color_on: "#0ea5e9",
    },
    {
      key: "petit_dej",
      match: "#dej",
      labels: {
        en: "Breakfast",
        fr: "Petit déj",
        de: "Frühstück",
        es: "Desayuno",
      },
      icon: "mdi:coffee-outline",
      color_off: "#9ca3af",
      color_on: "#f59e0b",
    },
    {
      key: "snacking",
      match: "#snack",
      labels: {
        en: "Snacks",
        fr: "Snacking",
        de: "Snacks",
        es: "Snacks",
      },
      icon: "mdi:food",
      color_off: "#9ca3af",
      color_on: "#f97316",
    },
    {
      key: "hygiene",
      match: "#hyg",
      labels: {
        en: "Hygiene",
        fr: "Hygiène",
        de: "Hygiene",
        es: "Higiene",
      },
      icon: "mdi:shower-head",
      color_off: "#9ca3af",
      color_on: "#6366f1",
    },
    {
      key: "beaute",
      match: "#beaute",
      labels: {
        en: "Beauty",
        fr: "Beauté",
        de: "Kosmetik",
        es: "Belleza",
      },
      icon: "mdi:lipstick",
      color_off: "#9ca3af",
      color_on: "#db2777",
    },
    {
      key: "bebe",
      match: "#bebe",
      labels: {
        en: "Baby",
        fr: "Bébé",
        de: "Baby",
        es: "Bebé",
      },
      icon: "mdi:baby-face-outline",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "animaux",
      match: "#anim",
      labels: {
        en: "Pets",
        fr: "Animaux",
        de: "Haustiere",
        es: "Mascotas",
      },
      icon: "mdi:paw",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "menage",
      match: "#men",
      labels: {
        en: "Cleaning",
        fr: "Ménage",
        de: "Haushalt",
        es: "Limpieza",
      },
      icon: "mdi:spray-bottle",
      color_off: "#9ca3af",
      color_on: "#6366f1",
    },
    {
      key: "entretien",
      match: "#entretien",
      labels: {
        en: "Maintenance",
        fr: "Entretien",
        de: "Wartung",
        es: "Mantenimiento",
      },
      icon: "mdi:tools",
      color_off: "#9ca3af",
      color_on: "#10b981",
    },
  ],

  // ----- URGENCE -----
  urgency: [
    {
      key: "no_due",
      match: "#nodue",
      labels: {
        en: "No deadline",
        fr: "Sans date",
        de: "Keine Frist",
        es: "Sin fecha",
      },
      icon: "mdi:calendar-remove-outline",
      color_off: "#9ca3af",
      color_on: "#6b7280",
    },
    {
      key: "long",
      match: "#long",
      labels: {
        en: "Long term",
        fr: "Long terme",
        de: "Langfristig",
        es: "Largo plazo",
      },
      icon: "mdi:calendar-month-outline",
      color_off: "#9ca3af",
      color_on: "#3b82f6",
      max_days: 30,
      warning_start_days: 7,
    },
    {
      key: "normal",
      match: "#norm",
      labels: {
        en: "Normal",
        fr: "Normal",
        de: "Normal",
        es: "Normal",
      },
      icon: "mdi:checkbox-blank-circle-outline",
      color_off: "#9ca3af",
      color_on: "#22c55e",
      max_days: 7,
      warning_start_days: 3,
    },
    {
      key: "bientot",
      match: "#soon",
      labels: {
        en: "Soon",
        fr: "Bientôt",
        de: "Bald",
        es: "Pronto",
      },
      icon: "mdi:clock-alert-outline",
      color_off: "#9ca3af",
      color_on: "#f97316",
      max_days: 4,
    },
    {
      key: "urgent",
      match: "#urg",
      labels: {
        en: "Urgent",
        fr: "Urgent",
        de: "Dringend",
        es: "Urgente",
      },
      icon: "mdi:alert",
      color_off: "#9ca3af",
      color_on: "#ef4444",
      max_days: 2,
      warning_start_days: 1,
    },
  ],

  // ----- HORIZON -----
  timeframe: [
    {
      key: "anytime",
      match: "#any",
      labels: {
        en: "Whenever",
        fr: "Quand on veut",
        de: "Wann man will",
        es: "Cuando sea",
      },
      icon: "mdi:infinity",
      color_off: "#9ca3af",
      color_on: "#6b7280",
    },
    {
      key: "today",
      match: "#today",
      labels: {
        en: "Today",
        fr: "Dans la journée",
        de: "Heute",
        es: "Hoy",
      },
      icon: "mdi:calendar-today",
      color_off: "#9ca3af",
      color_on: "#22c55e",
      max_days: 1,
    },
    {
      key: "week",
      match: "#week",
      labels: {
        en: "This week",
        fr: "Dans la semaine",
        de: "Diese Woche",
        es: "Esta semana",
      },
      icon: "mdi:calendar-week",
      color_off: "#9ca3af",
      color_on: "#22c55e",
      max_days: 7,
    },
    {
      key: "twoweeks",
      match: "#2w",
      labels: {
        en: "Within 2 weeks",
        fr: "Dans 2 semaines",
        de: "In 2 Wochen",
        es: "En 2 semanas",
      },
      icon: "mdi:calendar-range",
      color_off: "#9ca3af",
      color_on: "#f59e0b",
      max_days: 14,
    },
    {
      key: "month",
      match: "#month",
      labels: {
        en: "This month",
        fr: "Dans le mois",
        de: "Diesen Monat",
        es: "Este mes",
      },
      icon: "mdi:calendar-month",
      color_off: "#9ca3af",
      color_on: "#f97316",
      max_days: 30,
    },
    {
      key: "year",
      match: "#year",
      labels: {
        en: "This year",
        fr: "Dans l'année",
        de: "Dieses Jahr",
        es: "Este año",
      },
      icon: "mdi:calendar-star",
      color_off: "#9ca3af",
      color_on: "#3b82f6",
      max_days: 365,
    },
  ],

  // ----- PIECES -----
  rooms: [
    {
      key: "salon",
      match: "#salon",
      labels: {
        en: "Living room",
        fr: "Salon",
        de: "Wohnzimmer",
        es: "Salón",
      },
      icon: "mdi:sofa",
      color_off: "#9ca3af",
      color_on: "#f97316",
    },
    {
      key: "cuisine",
      match: "#cuisine",
      labels: {
        en: "Kitchen",
        fr: "Cuisine",
        de: "Küche",
        es: "Cocina",
      },
      icon: "mdi:stove",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "sdb",
      match: "#sdb",
      labels: {
        en: "Bathroom",
        fr: "Salle de bain",
        de: "Badezimmer",
        es: "Baño",
      },
      icon: "mdi:shower",
      color_off: "#9ca3af",
      color_on: "#0ea5e9",
    },
    {
      key: "wc",
      match: "#wc",
      labels: {
        en: "Toilet",
        fr: "WC",
        de: "WC",
        es: "WC",
      },
      icon: "mdi:toilet",
      color_off: "#9ca3af",
      color_on: "#6366f1",
    },
    {
      key: "ch_parents",
      match: "#ch_par",
      labels: {
        en: "Parents' room",
        fr: "Ch. parents",
        de: "Elternzimmer",
        es: "Dorm. padres",
      },
      icon: "mdi:bed-king",
      color_off: "#9ca3af",
      color_on: "#a855f7",
    },
    {
      key: "ch_enfant",
      match: "#ch_enf",
      labels: {
        en: "Kids' room",
        fr: "Ch. enfant",
        de: "Kinderzimmer",
        es: "Dorm. niño",
      },
      icon: "mdi:bed-single",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
    {
      key: "bureau",
      match: "#bureau",
      labels: {
        en: "Office",
        fr: "Bureau",
        de: "Büro",
        es: "Despacho",
      },
      icon: "mdi:desk",
      color_off: "#9ca3af",
      color_on: "#3b82f6",
    },
    {
      key: "garage",
      match: "#garage",
      labels: {
        en: "Garage",
        fr: "Garage",
        de: "Garage",
        es: "Garaje",
      },
      icon: "mdi:garage",
      color_off: "#9ca3af",
      color_on: "#f97316",
    },
    {
      key: "buanderie",
      match: "#buand",
      labels: {
        en: "Laundry",
        fr: "Buanderie",
        de: "Waschküche",
        es: "Lavadero",
      },
      icon: "mdi:washing-machine",
      color_off: "#9ca3af",
      color_on: "#0ea5e9",
    },
    {
      key: "couloir",
      match: "#couloir",
      labels: {
        en: "Hallway",
        fr: "Couloir",
        de: "Flur",
        es: "Pasillo",
      },
      icon: "mdi:arrow-right-bold",
      color_off: "#9ca3af",
      color_on: "#6b7280",
    },
    {
      key: "exterieur",
      match: "#ext",
      labels: {
        en: "Outside",
        fr: "Extérieur",
        de: "Außenbereich",
        es: "Exterior",
      },
      icon: "mdi:tree",
      color_off: "#9ca3af",
      color_on: "#22c55e",
    },
  ],
};

// couleurs par défaut pour la barre de progression (en % réalisés)
const DEFAULT_PROGRESS_COLORS = [
  { threshold: 90, color: "#3b82f6" }, // bleu
  { threshold: 60, color: "#22c55e" }, // vert
  { threshold: 40, color: "#f97316" }, // orange
  { threshold: 0, color: "#ef4444" }, // rouge
];

// couleur neutre (listes vides)
const DEFAULT_EMPTY_LIST_COLOR = "#9ca3af";

// ---- UI translations (only UI strings, not your todo content) ----
const UI_LABELS = {
  en: {
    config_missing_lists: "Raptor Todo Hub Card needs a 'lists' field.",
    default_title: "Tasks & shopping",
    subtitle: (done, total, percent, isEmpty) =>
      isEmpty ? "No tasks in this list." : `${done}/${total} completed (${percent}%)`,
    active: "ACTIVE",
    completed: "COMPLETED",
    empty_active: "No active task 🎉",
    empty_completed: "No completed task.",
    add_placeholder: "Add…",
    add_button: "Add",
    no_list: "No list configured.",
    entity_missing: (id) => `Entity not found: ${id}`,
    confirm_delete: (label) => `Permanently delete this task?\n\n"${label}"`,
    due_prefix: "Due",
  },
  fr: {
    config_missing_lists:
      "La carte Raptor Todo Hub a besoin d'un champ 'lists'.",
    default_title: "Tâches & courses",
    subtitle: (done, total, percent, isEmpty) =>
      isEmpty ? "Aucune tâche dans cette liste." : `${done}/${total} tâches terminées (${percent}%)`,
    active: "ACTIFS",
    completed: "COMPLÉTÉS",
    empty_active: "Aucune tâche active 🎉",
    empty_completed: "Aucune tâche complétée.",
    add_placeholder: "Ajouter…",
    add_button: "Ajouter",
    no_list: "Aucune liste configurée.",
    entity_missing: (id) => `Entité introuvable : ${id}`,
    confirm_delete: (label) =>
      `Supprimer définitivement la tâche :\n\n"${label}" ?`,
    due_prefix: "Échéance",
  },
};

class RaptorTodoHubCard extends LitElementBase {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _activeIndex: { type: Number },
      _itemsByEntity: { type: Object },
      _newText: { type: String },
      _selectedCatByEntity: { type: Object },
      _holdTimer: { type: Object },
      _holdActive: { type: Boolean },
    };
  }

  setConfig(config) {
    if (!config.lists || !Array.isArray(config.lists) || !config.lists.length) {
      throw new Error(UI_LABELS.fr.config_missing_lists);
    }

    const rawLang = config.language || config.languages || "en";
    const lang = String(rawLang).toLowerCase().split("-")[0];
    const langKey = UI_LABELS[lang] ? lang : "en";

    this._config = {
      title: config.title || UI_LABELS[langKey].default_title,
      title_mode: config.title_mode || "static",
      language: rawLang,
      lists: config.lists,
      progress_colors: config.progress_colors || DEFAULT_PROGRESS_COLORS,
    };

    this._activeIndex = 0;
    this._itemsByEntity = {};
    this._newText = "";
    this._selectedCatByEntity = {};
    this._holdTimer = null;
    this._holdActive = false;
  }

  set hass(hass) {
    this._hass = hass;
    this.requestUpdate();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 4;
  }

  // ------------------ HELPERS LANGUE ------------------

  _getLang() {
    if (this._config && this._config.language) {
      return this._normalizeLang(this._config.language);
    }
    const h = this.hass;
    if (h) {
      const cand = (h.locale && h.locale.language) || h.language || "en";
      return this._normalizeLang(cand);
    }
    return "en";
  }

  _normalizeLang(code) {
    if (!code) return "en";
    const short = String(code).toLowerCase().split("-")[0];
    return ["en", "fr", "de", "es"].includes(short) ? short : "en";
  }

  _getCategoryLabel(cat) {
    if (!cat) return "";
    const lang = this._getLang();
    if (cat.labels && cat.labels[lang]) return cat.labels[lang];
    if (cat.label) return cat.label;
    return cat.key || "";
  }

  _ui(key, ...args) {
    const lang = this._getLang();
    const dict = UI_LABELS[lang] || UI_LABELS.en;
    const val = dict[key] ?? UI_LABELS.en[key];
    return typeof val === "function" ? val(...args) : val;
  }

  // ------------------ HELPERS AUTO-REMOVE ------------------

  _parseAutoRemoveMeta(summary) {
    if (!summary) return null;
    const m = summary.match(AUTO_REMOVE_TAG_REGEX);
    if (!m) return null;
    return {
      start: parseInt(m[1], 10),
      delay: parseInt(m[2], 10),
    };
  }

  _stripAutoRemoveMeta(summary) {
    if (!summary) return summary;
    return summary.replace(AUTO_REMOVE_TAG_REGEX, "").trim();
  }

  _getAutoRemoveDelaySeconds(list) {
    const seconds = list.auto_remove_completed_seconds;
    if (!seconds || seconds <= 0) return 0;
    return seconds;
  }

  async _processAutoRemovalsForEntity(entityId, items) {
    if (!this._config || !this._config.lists) return;
    const list = this._config.lists.find((l) => l.entity === entityId);
    if (!list) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const toRemove = [];

    for (const item of items) {
      if (item.status !== "completed") continue;
      const meta = this._parseAutoRemoveMeta(item.summary || "");
      if (!meta) {
        const delay = this._getAutoRemoveDelaySeconds(list);
        if (delay > 0) {
          const base = this._stripAutoRemoveMeta(item.summary || "");
          const newSummary = `${base} #rtrm(${nowSec},${delay})`;
          try {
            await this._recreateItemWithSummaryAndStatus(
              entityId,
              item,
              newSummary,
              "completed"
            );
          } catch (err) {
            console.error("RaptorTodoHubCard: erreur ajout tag rtrm", err);
          }
        }
        continue;
      }

      const end = meta.start + meta.delay;
      if (nowSec >= end) {
        toRemove.push(item);
      }
    }

    if (toRemove.length) {
      for (const item of toRemove) {
        try {
          await this.hass.callService("todo", "remove_item", {
            entity_id: entityId,
            item: item.uid || item.summary,
          });
        } catch (err) {
          console.error(
            "RaptorTodoHubCard: erreur remove_item auto (persistant)",
            err
          );
        }
      }
      await this._fetchItemsFor(entityId, true);
    }
  }

  // helper pour recréer un item avec nouveau summary + statut (compatible HA récent)
  async _recreateItemWithSummaryAndStatus(entityId, item, newSummary, status) {
    const oldId = item.uid || item.summary;
    const due = item.due || item.due_date || null;

    // 1) supprimer l'ancien
    await this.hass.callService("todo", "remove_item", {
      entity_id: entityId,
      item: oldId,
    });

    // 2) recréer le nouvel item avec le texte mis à jour
    const addData = {
      entity_id: entityId,
      item: newSummary,
    };
    if (due) {
      addData.due_date = due;
    }
    await this.hass.callService("todo", "add_item", addData);

    // 3) remettre le statut souhaité
    if (status && status !== "needs_action") {
      await this.hass.callService("todo", "update_item", {
        entity_id: entityId,
        item: newSummary,
        status: status,
      });
    }
  }

  // ------------------ HELPERS DUE (sort_by: due / show_due_date) ------------------

  _getItemDueDate(item) {
    const dueStr = item?.due || item?.due_date;
    if (!dueStr) return null;
    const d = new Date(dueStr);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  _hasMeaningfulTime(dueStr) {
    if (!dueStr || typeof dueStr !== "string") return false;
    if (!dueStr.includes("T")) return false;
    const d = new Date(dueStr);
    if (Number.isNaN(d.getTime())) return false;
    return !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
  }

  _formatDue(item) {
    const dueStr = item?.due || item?.due_date;
    const d = this._getItemDueDate(item);
    if (!d) return "";

    const lang = this._getLang();
    const locale = this.hass?.locale?.language ? this.hass.locale.language : lang;

    const includeTime = this._hasMeaningfulTime(dueStr);
    const opts = includeTime
      ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "2-digit", day: "2-digit" };

    try {
      return new Intl.DateTimeFormat(locale, opts).format(d);
    } catch (_e) {
      return d.toLocaleString();
    }
  }

  // ------------------ TRI (sort_by) ------------------

  // Tri par urgence (preset: urgency) selon ordre A:
  // URGENT → SOON → NORMAL → LONG TERM → NO DUE
  _getUrgencyRank(list, item) {
    const summary = this._stripAutoRemoveMeta(item?.summary || "");
    const cats = this._getCategories(list);
    const cat = this._resolveCategory(cats, summary);
    if (!cat) return 999;

    const key = String(cat.key || "").toLowerCase();

    // mapping basé sur les keys du preset "urgency"
    const map = {
      urgent: 0,
      bientot: 1,
      normal: 2,
      long: 3,
      no_due: 4,
    };

    if (map[key] === undefined) return 998;
    return map[key];
  }

  _sortItemsForList(list, items) {
    const mode = (list && list.sort_by) || "none";
    if (!items || items.length <= 1) return items || [];

    // 1) Tri par date d'échéance HA
    if (mode === "due") {
      const arr = [...items];
      arr.sort((a, b) => {
        const da = this._getItemDueDate(a);
        const db = this._getItemDueDate(b);
        if (!da && !db) return String(a.summary || "").localeCompare(String(b.summary || ""));
        if (!da) return 1;
        if (!db) return -1;
        const diff = da.getTime() - db.getTime();
        if (diff !== 0) return diff;
        return String(a.summary || "").localeCompare(String(b.summary || ""));
      });
      return arr;
    }

    // 2) Tri par urgence (tags/catégories), ordre A
    if (mode === "urgency") {
      const arr = [...items];
      arr.sort((a, b) => {
        const ra = this._getUrgencyRank(list, a);
        const rb = this._getUrgencyRank(list, b);
        if (ra !== rb) return ra - rb;

        // Si même urgence: due d'abord si présent, sinon texte
        const da = this._getItemDueDate(a);
        const db = this._getItemDueDate(b);
        if (da && db) {
          const diff = da.getTime() - db.getTime();
          if (diff !== 0) return diff;
        } else if (da && !db) {
          return -1;
        } else if (!da && db) {
          return 1;
        }

        return String(a.summary || "").localeCompare(String(b.summary || ""));
      });
      return arr;
    }

    return items;
  }

  // ------------------ STYLES ------------------

  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-card {
        padding: 16px;
      }

      .header {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }
      .title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .title {
        font-size: 1.2rem;
        font-weight: 600;
      }
      .subtitle {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }

      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
        -webkit-tap-highlight-color: transparent;
      }
      .tab {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 10px 6px;
        border-radius: 12px;
        font-size: 0.8rem;
        background: var(--ha-card-background, #f3f4f6);
        color: var(--primary-text-color);
        cursor: pointer;
        border: 1px solid transparent;
        min-width: 90px;
        transition: border-width 0.15s, box-shadow 0.15s;
      }
      .tab-main {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .tab ha-icon {
        --mdc-icon-size: 16px;
      }
      .tab-count {
        font-size: 0.75rem;
        opacity: 0.7;
      }
      .tab.active {
        border-width: 2px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
      }

      .tab-progress {
        width: 100%;
        height: 4px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }
      .tab-progress-bar {
        height: 100%;
        border-radius: inherit;
        transition: width 0.2s ease-out, background-color 0.2s;
      }

      .divider {
        height: 1px;
        margin: 8px 0;
        background: var(--divider-color);
      }

      .add-row {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 8px 0 4px;
      }
      .add-row input {
        flex: 1;
        border-radius: 999px;
        border: 1px solid var(--divider-color);
        padding: 6px 10px;
        font-size: 0.9rem;
        background: var(--ha-card-background, #fff);
        color: var(--primary-text-color);
      }
      .add-row button {
        border-radius: 999px;
        border: none;
        padding: 6px 14px;
        font-size: 0.85rem;
        cursor: pointer;
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
      }

      .cat-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .cat-chip {
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        cursor: pointer;
        color: #ffffff;
        background: #6b7280;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border: 1px solid transparent;
      }
      .cat-chip.selected {
        opacity: 1;
        border-width: 2px;
        border-style: solid;
        border-color: #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
      }

      .section-label {
        font-size: 0.8rem;
        font-weight: 600;
        margin: 4px 0;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .empty {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        padding: 4px 0;
      }

      .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }
      .item-icon {
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .item-main {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .item-label {
        font-size: 0.92rem;
      }
      .item-label.completed {
        text-decoration: line-through;
        opacity: 0.7;
      }

      .cat-pill {
        padding: 2px 6px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        color: #ffffff;
        background: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      /* due badge */
      .due-pill {
        padding: 2px 6px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--primary-text-color);
        background: rgba(0, 0, 0, 0.08);
        letter-spacing: 0.01em;
      }
    `;
  }

  // ------------------ RENDER ------------------

  render() {
    if (!this.hass || !this._config) return html``;

    const lists = this._config.lists;
    const index = this._activeIndex ?? 0;
    const list = lists[index] || lists[0];

    if (!list) {
      return html`<ha-card>${this._ui("no_list")}</ha-card>`;
    }

    const entityId = list.entity;
    const stateObj = this.hass.states[entityId];

    if (!stateObj) {
      return html`<ha-card>${this._ui("entity_missing", entityId)}</ha-card>`;
    }

    let items = this._itemsByEntity[entityId];
    if (!items) {
      this._fetchItemsFor(entityId);
      items = [];
    }

    // Tri optionnel
    const activeRaw = items.filter((it) => it.status !== "completed");
    const completedRaw = items.filter((it) => it.status === "completed");
    const active = this._sortItemsForList(list, activeRaw);
    const completed = this._sortItemsForList(list, completedRaw);

    const total = items.length;
    const done = completedRaw.length;

    const isEmptyList = total === 0;
    const percent = total ? Math.round((done / total) * 100) : null;

    const cardTitle = this._getHeaderTitle(list);

    return html`
      <ha-card>
        <div class="header">
          <div class="title-row">
            <div class="title">${cardTitle}</div>
            <div class="subtitle">
              ${this._ui("subtitle", done, total, percent ?? 0, isEmptyList)}
            </div>
          </div>

          <div class="tabs">${lists.map((l, i) => this._renderTab(l, i))}</div>
        </div>

        <div class="divider"></div>

        ${this._renderAddRow(list)}

        <div class="section-label">
          ${this._ui("active")} (${active.length})
        </div>
        ${active.length === 0
          ? html`<div class="empty">${this._ui("empty_active")}</div>`
          : active.map((item) => this._renderItem(list, item, false))}

        <div class="section-label">
          ${this._ui("completed")} (${completed.length})
        </div>
        ${completed.length === 0
          ? html`<div class="empty">${this._ui("empty_completed")}</div>`
          : completed.map((item) => this._renderItem(list, item, true))}
      </ha-card>
    `;
  }

  _getHeaderTitle(list) {
    const mode = this._config.title_mode || "static";
    if (mode !== "per_list" || !list) {
      return (
        this._config.title ||
        UI_LABELS[this._getLang()]?.default_title ||
        UI_LABELS.en.default_title
      );
    }

    const entityId = list.entity;
    const friendly =
      this.hass?.states?.[entityId]?.attributes?.friendly_name || entityId;

    return list.header_title || list.label || list.name || friendly;
  }

  // ------------------ SOUS-RENDU ------------------

  _renderTab(list, index) {
    const entityId = list.entity;
    let items = this._itemsByEntity[entityId];

    if (!items) {
      this._fetchItemsFor(entityId);
      items = [];
    }

    const active = items.filter((it) => it.status !== "completed");
    const completed = items.filter((it) => it.status === "completed");
    const total = items.length;
    const done = completed.length;

    const percent = total ? Math.round((done / total) * 100) : null;

    const isActive = index === this._activeIndex;
    const label =
      list.label ||
      list.name ||
      this.hass.states[entityId]?.attributes?.friendly_name ||
      entityId;

    const icon = list.icon || "mdi:format-list-checkbox";

    const progressColor = this._getProgressColor(list, percent);
    const severityColor = this._getListSeverityColor(list, items);
    const tabMode = list.tab_color_mode || "mixed";

    let tabColor;
    switch (tabMode) {
      case "progress":
        tabColor = progressColor;
        break;
      case "severity":
        tabColor = severityColor || progressColor;
        break;
      case "mixed":
      default:
        tabColor = severityColor || progressColor;
        break;
    }

    const showBar = list.show_progress_bar !== false;
    const widthPercent = percent == null ? 0 : percent;

    return html`
      <div
        class="tab ${isActive ? "active" : ""}"
        style="border-color:${tabColor};"
        @click=${() => (this._activeIndex = index)}
      >
        <div class="tab-main">
          <ha-icon .icon=${icon} style="color:${tabColor};"></ha-icon>
          <span>${label}</span>
          <span class="tab-count">${active.length}/${total}</span>
        </div>
        ${showBar
          ? html`
              <div class="tab-progress">
                <div
                  class="tab-progress-bar"
                  style="width:${widthPercent}%; background:${progressColor};"
                ></div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  _renderAddRow(list) {
    const entityId = list.entity;
    const cats = this._getCategories(list);
    const selectedKey = this._selectedCatByEntity[entityId] || null;

    return html`
      <div class="add-row">
        <input
          type="text"
          .value=${this._newText || ""}
          placeholder=${this._ui("add_placeholder")}
          @input=${(e) => (this._newText = e.target.value)}
          @keydown=${(e) => this._onInputKeydown(e, list)}
        />
        <button @click=${() => this._addItem(list)}>
          ${this._ui("add_button")}
        </button>
      </div>

      ${cats.length && this._newText && this._newText.trim() !== ""
        ? html`
            <div class="cat-row">
              ${cats.map((cat) => {
                const isSelected = cat.key === selectedKey;
                const bg = cat.color_on || cat.color || "#6b7280";
                const label = this._getCategoryLabel(cat);
                return html`
                  <div
                    class="cat-chip ${isSelected ? "selected" : ""}"
                    style="background:${bg};"
                    @click=${() => this._selectCategory(entityId, cat.key)}
                  >
                    ${label}
                  </div>
                `;
              })}
            </div>
          `
        : ""}
    `;
  }

  _renderItem(list, item, completed) {
    const rawSummary = item.summary || "";
    const withoutAuto = this._stripAutoRemoveMeta(rawSummary);
    const cats = this._getCategories(list);
    const cat = this._resolveCategory(cats, withoutAuto);
    const labelText = this._stripCategory(withoutAuto, cat);
    const colors = this._getItemColors(list, item, cat, completed);

    const icon = cat?.icon || "mdi:checkbox-blank-circle";
    const catLabel = cat ? this._getCategoryLabel(cat) : "";

    const showDue = list.show_due_date === true;
    const dueText = showDue ? this._formatDue(item) : "";

    return html`
      <div class="item">
        <div
          class="item-icon"
          @click=${() => this._toggleItem(list, item)}
          @pointerdown=${(e) => this._onItemPointerDown(e, list, item)}
          @pointerup=${() => this._onItemPointerUp()}
          @pointercancel=${() => this._onItemPointerUp()}
          @pointerleave=${() => this._onItemPointerUp()}
        >
          <ha-icon .icon=${icon} style="color:${colors.iconColor};"></ha-icon>
        </div>

        <div class="item-main">
          <div class="item-label ${completed ? "completed" : ""}">
            ${labelText}
          </div>

          ${catLabel
            ? html`<div class="cat-pill" style="background:${colors.pillColor};">
                ${catLabel}
              </div>`
            : ""}

          ${dueText
            ? html`<div class="due-pill">
                ${this._ui("due_prefix")}: ${dueText}
              </div>`
            : ""}
        </div>
      </div>
    `;
  }

  _onItemPointerDown(e, list, item) {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdActive = false;

    this._holdTimer = setTimeout(() => {
      this._holdActive = true;
      this._confirmDelete(list, item);
    }, 650);
  }

  _onItemPointerUp() {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
  }

  async _confirmDelete(list, item) {
    const raw = item.summary || "";
    const withoutAuto = this._stripAutoRemoveMeta(raw);
    const cat = this._resolveCategory(this._getCategories(list), withoutAuto);
    const labelText = this._stripCategory(withoutAuto, cat) || raw;

    const ok = window.confirm(this._ui("confirm_delete", labelText));
    if (!ok) return;

    try {
      await this.hass.callService("todo", "remove_item", {
        entity_id: list.entity,
        item: item.uid || item.summary,
      });
      await this._fetchItemsFor(list.entity);
    } catch (err) {
      console.error("RaptorTodoHubCard: erreur suppression manuelle", err);
    }
  }

  // ------------------ CATEGORIES & PRESETS ------------------

  _getCategories(list) {
    const fromPreset = list.preset ? RAPTOR_TODO_PRESETS[list.preset] || [] : [];
    const custom = list.categories || [];

    const merged = [...fromPreset];
    custom.forEach((c) => {
      const idx = merged.findIndex((m) => m.key === c.key);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...c };
      else merged.push(c);
    });

    return merged;
  }

  _selectCategory(entityId, key) {
    this._selectedCatByEntity = {
      ...this._selectedCatByEntity,
      [entityId]: key,
    };
  }

  _resolveCategory(cats, summary) {
    if (!cats.length || !summary) return null;
    return cats.find((cat) => cat.match && summary.includes(cat.match)) || null;
  }

  _stripCategory(summary, cat) {
    if (!cat || !summary || !cat.match) return summary;
    return summary.replace(cat.match, "").trim();
  }

  _getDefaultCategory(list) {
    const cats = this._getCategories(list);
    if (!list.default_category) return null;
    return cats.find((c) => c.key === list.default_category) || null;
  }

  // ------------------ COULEURS (progress + urgence) ------------------

  _getProgressColor(list, percent) {
    // liste vide => couleur neutre
    if (percent == null) {
      return list.empty_list_color || DEFAULT_EMPTY_LIST_COLOR;
    }

    const table =
      list.progress_colors ||
      this._config.progress_colors ||
      DEFAULT_PROGRESS_COLORS;
    const sorted = [...table].sort((a, b) => b.threshold - a.threshold);
    const entry = sorted.find((e) => percent >= e.threshold);
    return entry ? entry.color : "#22c55e";
  }

  _getItemUrgencyLevel(list, item, cat) {
    const colorMode = list.color_mode || "category";
    if (colorMode !== "urgency_age") return 0;
    if (!cat || !cat.max_days) return 0;
    if (!item.due && !item.due_date) return 0;

    const dueStr = item.due || item.due_date;
    const due = new Date(dueStr);
    if (Number.isNaN(due.getTime())) return 0;

    const now = new Date();
    const diffMs = now.getTime() - due.getTime();
    const diffDays = diffMs / 86400000;

    if (diffDays <= 0) return 0;

    const maxDays = cat.max_days;
    const warnStart =
      typeof cat.warning_start_days === "number" ? cat.warning_start_days : 0;

    if (maxDays && diffDays >= maxDays) return 2;
    if (warnStart && diffDays >= warnStart) return 1;
    if (!warnStart && diffDays > 0 && diffDays < maxDays) return 1;
    return 0;
  }

  _getItemColors(list, item, cat, completed) {
    const baseOff = cat?.color_off || "#9ca3af";
    const baseOn = cat?.color_on || cat?.color || "#22c55e";

    let iconColor = completed ? baseOn : baseOff;
    let pillColor = baseOn;

    const urgencyLevel = this._getItemUrgencyLevel(list, item, cat);
    const warnColor = list.urgency_warning_color || "#f97316";
    const dangerColor = list.urgency_overdue_color || "#ef4444";

    if (urgencyLevel === 1) {
      iconColor = warnColor;
      pillColor = warnColor;
    } else if (urgencyLevel === 2) {
      iconColor = dangerColor;
      pillColor = dangerColor;
    }

    return { iconColor, pillColor };
  }

  _getListSeverityColor(list, items) {
    const cats = this._getCategories(list);
    let worstLevel = 0;

    for (const item of items) {
      const raw = item.summary || "";
      const withoutAuto = this._stripAutoRemoveMeta(raw);
      const cat = this._resolveCategory(cats, withoutAuto);
      const lvl = this._getItemUrgencyLevel(list, item, cat);
      if (lvl > worstLevel) worstLevel = lvl;
      if (worstLevel === 2) break;
    }

    if (worstLevel === 2) return list.urgency_overdue_color || "#ef4444";
    if (worstLevel === 1) return list.urgency_warning_color || "#f97316";
    return null;
  }

  // ------------------ TODO : LECTURE / AJOUT / TOGGLE ------------------

  async _fetchItemsFor(entityId, skipAutoRemove = false) {
    if (!this.hass || !entityId) return;

    try {
      const result = await this.hass.callWS({
        type: "todo/item/list",
        entity_id: entityId,
      });

      const items =
        result?.items ||
        (result && result[entityId] && result[entityId].items) ||
        [];

      this._itemsByEntity = {
        ...this._itemsByEntity,
        [entityId]: items,
      };

      if (!skipAutoRemove) {
        await this._processAutoRemovalsForEntity(entityId, items);
      }
    } catch (err) {
      console.error(
        "Raptor Todo Hub Card: erreur todo/item/list pour",
        entityId,
        err
      );
    }
  }

  _onInputKeydown(e, list) {
    if (e.key === "Enter") {
      e.preventDefault();
      this._addItem(list);
    }
  }

  async _addItem(list) {
    if (!this.hass || !list?.entity) return;

    let text = (this._newText || "").trim();
    if (!text) return;

    const entityId = list.entity;
    const cats = this._getCategories(list);
    const selectedKey = this._selectedCatByEntity[entityId] || null;
    let cat = cats.find((c) => c.key === selectedKey);

    if (!cat) {
      cat = this._getDefaultCategory(list);
    }

    if (cat && cat.match) {
      text = `${text} ${cat.match}`;
    }

    try {
      await this.hass.callService("todo", "add_item", {
        entity_id: list.entity,
        item: text,
      });

      this._newText = "";
      await this._fetchItemsFor(list.entity);
    } catch (err) {
      console.error("Raptor Todo Hub Card: erreur ajout item", err);
    }
  }

  async _toggleItem(list, item) {
    if (!this.hass || !list?.entity) return;

    const entityId = list.entity;
    const isCompleted = item.status === "completed";
    const newStatus = isCompleted ? "needs_action" : "completed";

    let summary = item.summary || "";
    summary = this._stripAutoRemoveMeta(summary);

    if (!isCompleted) {
      const delay = this._getAutoRemoveDelaySeconds(list);
      if (delay > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        summary = `${summary} #rtrm(${nowSec},${delay})`;
      }
    }

    try {
      await this._recreateItemWithSummaryAndStatus(
        entityId,
        item,
        summary,
        newStatus
      );

      await this._fetchItemsFor(entityId);
    } catch (err) {
      console.error("RaptorTodoHubCard: erreur update item", err);
    }
  }

  static getStubConfig() {
    return {
      title: "Tâches & courses",
      language: "fr",
      lists: [{ entity: "todo.liste_de_course", label: "Courses" }],
    };
  }
}

customElements.define("raptor-todo-hub-card", RaptorTodoHubCard);

console.info(
  "%cRaptor Todo Hub Card%c loaded",
  "color: white; background:#22c55e; padding:2px 6px; border-radius:4px;",
  "color:#22c55e;"
);
