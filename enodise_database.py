import hvplot.pandas
import numpy as np
import pandas as pd
import panel as pn


PRIMARY_COLOR = "#E31244"
SECONDARY_COLOR = "#F28F42"

CSV_FILE = 'https://raw.githubusercontent.com/christjul/test_panel/main/enodise_database.csv'
PARAM = ['Configuration', 'Type', 'Author']
PARAM_TECH = ['Experimental technique', 'Numerical technique']

pn.extension(design="material", sizing_mode="stretch_width")
pn.extension('mathjax')

# Custom CSS to style disabled widgets (graying them out)
pn.config.raw_css.append("""
select:disabled, button:disabled, input:disabled {
    background-color: #f0f0f0 !important;
    color: #a0a0a0 !important;
    cursor: not-allowed;
    opacity: 0.6;
},
option:disabled {
    background-color: #d0d0d0 !important;
    color: #808080 !important;
}
""")



# @pn.cache
# def get_data():
#   return pd.read_csv(CSV_FILE, sep=';')

# df = get_data()

# Function to fetch CSV file and load into pandas DataFrame
def load_csv():
    df = pd.read_csv(CSV_FILE, sep=';')
    return df

# Load the CSV file
df = load_csv()

# Create a widget for each column to filter by unique values
widget_list = []
for p in PARAM:
    widget_list.append(pn.widgets.MultiSelect(name=p, 
                                              options=list(df[p].unique()), 
                                              value=list(df[p].unique()), 
                                              size=len(list(df[p].unique()))))
widget_list.append(pn.widgets.MultiSelect(name='Data Type', 
                                          options=['Geometry','Performance', 'Aerodynamic', 'Acoustic'], 
                                          size=4))
for p in PARAM_TECH:
    widget_list.append(pn.widgets.MultiSelect(name=p, 
                                              options=list(df[p].dropna().unique()), 
                                              value=list(df[p].dropna().unique()), 
                                              size=len(list(df[p].dropna().unique()))))

@pn.depends(*widget_list)
def filter_df(partner, typed, configuration, data_type, exp_tech, num_tech):
    # Filter the dataframe based on selected values in widgets
    filtered_df = df[
        (df[PARAM[0]].isin(partner)) & 
        (df[PARAM[1]].isin(typed)) & 
        (df[PARAM[2]].isin(configuration))
    ]
    for dt in data_type:
        filtered_df = filtered_df[filtered_df[dt]==True]

    # Filter the dataframe based on selected values in widgets
    filtered_df = filtered_df[
        (filtered_df[PARAM_TECH[0]].isin(exp_tech)) |
        (filtered_df[PARAM_TECH[1]].isin(num_tech))
        ]

    column = pn.Column()
    column.append(pn.indicators.Number(name='Number of databases', value=filtered_df.shape[0]))

    for i, fdf in filtered_df.iterrows():
        list_column_fdf = fdf.tolist()
        
        # flags
        flagsi = [list_column_fdf[0],
                  list_column_fdf[1],
                  'Config '+ list_column_fdf[2]]

        # type of exp/sim simulation type
        if list_column_fdf[5]:
            if list_column_fdf[1] == 'Experimental':
                flagsi.append(list_column_fdf[7])
            elif list_column_fdf[1] == 'Numerical':
                flagsi.append(list_column_fdf[8])


        flags = pn.widgets.MultiChoice(value=flagsi, options=flagsi, disabled=True, delete_button=False)

        # data types
        data_type_list = pn.Row()
        for i, dti in enumerate(list_column_fdf[3:7]):
            if dti:
                data_type_list.append(pn.widgets.ButtonIcon(icon="check", size="2em", name=filtered_df.columns[i+3]))
            else:
                data_type_list.append(pn.widgets.ButtonIcon(icon="x", size="2em", name=filtered_df.columns[i+3]))
        
        # description
        description = pn.pane.Markdown(list_column_fdf[10])
        
        # description
        small_DOI = "/".join(list_column_fdf[11].split("/")[-2:])
        DOI = pn.pane.Markdown('DOI: ['+small_DOI+']('+list_column_fdf[11]+')')
        
        card = pn.Card(flags, 
                       data_type_list, 
                       description, 
                       DOI, 
                       title='['+fdf['Author']+'] '+list_column_fdf[9], 
                       styles={'background': 'WhiteSmoke'})
        column.append(card)


    return column


def on_widget_change(event):
    if ('Experimental' in widget_list[1].value) and ('Aerodynamic' in widget_list[3].value):
        widget_list[4].disabled = False
        widget_list[4].value=list(df['Experimental technique'].unique())
    else:
        widget_list[4].value=list(df['Experimental technique'].unique())
        widget_list[4].disabled = True

    if ('Numerical' in widget_list[1].value) and ('Aerodynamic' in widget_list[3].value):
        widget_list[5].disabled = False
        widget_list[5].value=list(df['Numerical technique'].unique())
    else:
        widget_list[5].value=list(df['Numerical technique'].unique())
        widget_list[5].disabled = True

# Watch for changes in the MultiSelect widget
widget_list[1].param.watch(on_widget_change, 'value')
widget_list[3].param.watch(on_widget_change, 'value')

pn.template.MaterialTemplate(
    site="ENODISE Databases",
    title="Explore the project outputs",
    header_background=PRIMARY_COLOR,
    sidebar=widget_list,
    main=filter_df,
).servable()

on_widget_change(None)