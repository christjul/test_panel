importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/wheels/bokeh-3.6.0-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.5.2/dist/wheels/panel-1.5.2-py3-none-any.whl', 'pyodide-http==0.2.1', 'hvplot', 'numpy', 'pandas']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  \nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\nimport hvplot.pandas\nimport numpy as np\nimport pandas as pd\nimport panel as pn\nimport urllib.request\nimport io\n\n\nPRIMARY_COLOR = "#E31244"\nSECONDARY_COLOR = "#F28F42"\n\nCSV_FILE = 'https://raw.githubusercontent.com/christjul/test_panel/main/enodise_database.csv'\nPARAM = ['Configuration', 'Type', 'Author']\nPARAM_TECH = ['Experimental technique', 'Numerical technique']\n\npn.extension(design="material", sizing_mode="stretch_width")\npn.extension('mathjax')\n\n# Custom CSS to style disabled widgets (graying them out)\npn.config.raw_css.append("""\nselect:disabled, button:disabled, input:disabled {\n    background-color: #f0f0f0 !important;\n    color: #a0a0a0 !important;\n    cursor: not-allowed;\n    opacity: 0.6;\n},\noption:disabled {\n    background-color: #d0d0d0 !important;\n    color: #808080 !important;\n}\n""")\n\n\n\n# @pn.cache\n# def get_data():\n#   return pd.read_csv(CSV_FILE, sep=';')\n\n# df = get_data()\n\n# Function to fetch CSV file and load into pandas DataFrame\ndef load_csv():\n    with urllib.request.urlopen(CSV_FILE) as response:\n        data = response.read().decode('utf-8', errors='ignore')  # Decode using utf-8 and ignore errors\n        df = pd.read_csv(io.StringIO(data), sep=';')\n    return df\n\n# Load the CSV file\ndf = load_csv()\n\n# Create a widget for each column to filter by unique values\nwidget_list = []\nfor p in PARAM:\n    widget_list.append(pn.widgets.MultiSelect(name=p, \n                                              options=list(df[p].unique()), \n                                              value=list(df[p].unique()), \n                                              size=len(list(df[p].unique()))))\nwidget_list.append(pn.widgets.MultiSelect(name='Data Type', \n                                          options=['Geometry','Performance', 'Aerodynamic', 'Acoustic'], \n                                          size=4))\nfor p in PARAM_TECH:\n    widget_list.append(pn.widgets.MultiSelect(name=p, \n                                              options=list(df[p].dropna().unique()), \n                                              value=list(df[p].dropna().unique()), \n                                              size=len(list(df[p].dropna().unique()))))\n\n@pn.depends(*widget_list)\ndef filter_df(partner, typed, configuration, data_type, exp_tech, num_tech):\n    # Filter the dataframe based on selected values in widgets\n    filtered_df = df[\n        (df[PARAM[0]].isin(partner)) & \n        (df[PARAM[1]].isin(typed)) & \n        (df[PARAM[2]].isin(configuration))\n    ]\n    for dt in data_type:\n        filtered_df = filtered_df[filtered_df[dt]==True]\n\n    # Filter the dataframe based on selected values in widgets\n    filtered_df = filtered_df[\n        (filtered_df[PARAM_TECH[0]].isin(exp_tech)) |\n        (filtered_df[PARAM_TECH[1]].isin(num_tech))\n        ]\n\n    column = pn.Column()\n    column.append(pn.indicators.Number(name='Number of databases', value=filtered_df.shape[0]))\n\n    for i, fdf in filtered_df.iterrows():\n        list_column_fdf = fdf.tolist()\n        \n        # flags\n        flagsi = [list_column_fdf[0],\n                  list_column_fdf[1],\n                  'Config '+ list_column_fdf[2]]\n\n        # type of exp/sim simulation type\n        if list_column_fdf[5]:\n            if list_column_fdf[1] == 'Experimental':\n                flagsi.append(list_column_fdf[7])\n            elif list_column_fdf[1] == 'Numerical':\n                flagsi.append(list_column_fdf[8])\n\n\n        flags = pn.widgets.MultiChoice(value=flagsi, options=flagsi, disabled=True, delete_button=False)\n\n        # data types\n        data_type_list = pn.Row()\n        for i, dti in enumerate(list_column_fdf[3:7]):\n            if dti:\n                data_type_list.append(pn.widgets.ButtonIcon(icon="check", size="2em", name=filtered_df.columns[i+3]))\n            else:\n                data_type_list.append(pn.widgets.ButtonIcon(icon="x", size="2em", name=filtered_df.columns[i+3]))\n        \n        # description\n        description = pn.pane.Markdown(list_column_fdf[10])\n        \n        # description\n        small_DOI = "/".join(list_column_fdf[11].split("/")[-2:])\n        DOI = pn.pane.Markdown('DOI: ['+small_DOI+']('+list_column_fdf[11]+')')\n        \n        card = pn.Card(flags, \n                       data_type_list, \n                       description, \n                       DOI, \n                       title='['+fdf['Author']+'] '+list_column_fdf[9], \n                       styles={'background': 'WhiteSmoke'})\n        column.append(card)\n\n\n    return column\n\n\ndef on_widget_change(event):\n    if ('Experimental' in widget_list[1].value) and ('Aerodynamic' in widget_list[3].value):\n        widget_list[4].disabled = False\n        widget_list[4].value=list(df['Experimental technique'].unique())\n    else:\n        widget_list[4].value=list(df['Experimental technique'].unique())\n        widget_list[4].disabled = True\n\n    if ('Numerical' in widget_list[1].value) and ('Aerodynamic' in widget_list[3].value):\n        widget_list[5].disabled = False\n        widget_list[5].value=list(df['Numerical technique'].unique())\n    else:\n        widget_list[5].value=list(df['Numerical technique'].unique())\n        widget_list[5].disabled = True\n\n# Watch for changes in the MultiSelect widget\nwidget_list[1].param.watch(on_widget_change, 'value')\nwidget_list[3].param.watch(on_widget_change, 'value')\n\npn.template.MaterialTemplate(\n    site="ENODISE Databases",\n    title="Explore the project outputs",\n    header_background=PRIMARY_COLOR,\n    sidebar=widget_list,\n    main=filter_df,\n).servable()\n\non_widget_change(None)\n\nawait write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    from panel.io.pyodide import _convert_json_patch
    state.curdoc.apply_json_patch(_convert_json_patch(patch), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()