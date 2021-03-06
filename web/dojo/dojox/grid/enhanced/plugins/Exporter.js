/*
	Copyright (c) 2004-2011, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/


if(!dojo._hasResource["dojox.grid.enhanced.plugins.Exporter"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["dojox.grid.enhanced.plugins.Exporter"] = true;
dojo.provide("dojox.grid.enhanced.plugins.Exporter");

dojo.require("dojox.grid.enhanced._Plugin");
dojo.require("dojox.grid._RowSelector");

dojo.declare("dojox.grid.enhanced.plugins.Exporter", dojox.grid.enhanced._Plugin, {
	// summary:
	//		Provide functions to export the grid data into a given format.
	//
	//		Acceptable plugin parameters:
	//		1. exportFormatter: function(data, cell, rowIndex, item)
	//				Provide a way to customize how data should look in exported string.
	//				Note that usually the formatter of grid cell should not be used here (it can return HTML or even widget).
	// example:
	//	|	function onExported(exported_text){
	//	|		//custom code here...
	//	|	}
	//	|	dijit.byId("my_grid_id").exportTo("csv",	//registered export format, mandatory
	//	|		{										//the whole object is optional.
	//	|			fetchArgs: {start:0,count:1000},	//keywordArgs for fetch, optional
	//	|			writerArgs: {separator:';'},		//export writer specific arguments, optional
	//	|		},
	//	|		function(str){
	//	|			//call back function, mandatory
	//	|	});
	//	|	var result = dijit.byId("my_grid_id").exportSelectedTo("table",     //registered export format, mandatory
	//	|														{separator:'|'} //export writer specific arguments, optional
	//	|	);
	//

	// name: String
	//		Plugin name.
	name: "exporter",
	
	constructor: function(grid, args){
		// summary:
		//		only newed by _Plugin
		// grid: EnhancedGrid
		//		The grid to plug in to.
		this.grid = grid;
		this.formatter = (args && dojo.isObject(args)) && args.exportFormatter;
		this._mixinGrid();
	},
	_mixinGrid: function(){
		var g = this.grid;
		g.exportTo = dojo.hitch(this, this.exportTo);
		g.exportGrid = dojo.hitch(this, this.exportGrid);
		g.exportSelected = dojo.hitch(this, this.exportSelected);
		g.setExportFormatter = dojo.hitch(this, this.setExportFormatter);
	},
	setExportFormatter: function(formatter){
		this.formatter = formatter;
	},
	exportGrid: function(type, args, onExported){
		// summary:
		//		Export required rows(fetchArgs) to a kind of format(type)
		//		using the corresponding writer with given arguments(writerArgs),
		//		then pass the exported text to a given function(onExported).
		// tags:
		//		public
		// type: string
		//		A registered export format name
		// args: object?
		//		includes:
		//		{
		//			fetchArgs: object?
		//				Any arguments for store.fetch
		//			writerArgs: object?
		//				Arguments for the given format writer
		//		}
		// onExported: function(string)
		//		Call back function when export result is ready
		if(dojo.isFunction(args)){
			onExported = args;
			args = {};
		}
		if(!dojo.isString(type) || !dojo.isFunction(onExported)){
			return;
		}
		args = args || {};
		var g = this.grid, _this = this,
			writer = this._getExportWriter(type, args.writerArgs),
			fetchArgs = (args.fetchArgs && dojo.isObject(args.fetchArgs)) ? args.fetchArgs : {},
			oldFunc = fetchArgs.onComplete;
		if(g.store){
			fetchArgs.onComplete = function(items, request){
				if(oldFunc){
					oldFunc(items, request);
				}
				onExported(_this._goThroughGridData(items, writer));
			};
			fetchArgs.sort = fetchArgs.sort || g.getSortProps();
			g._storeLayerFetch(fetchArgs);
		}else{
			//Data is defined directly in the structure;
			var start = fetchArgs.start || 0,
				count = fetchArgs.count || -1,
				items = [];
			for(var i = start; i != start + count && i < g.rowCount; ++i){
				items.push(g.getItem(i));
			}
			onExported(this._goThroughGridData(items, writer));
		}
	},
	exportSelected: function(type, writerArgs){
		// summary:
		//		Only export selected rows.
		// tags:
		//		public
		// type: string
		//		A registered export format name
		// writerArgs: object?
		//		Arguments for the given format writer
		// returns: string
		//		The exported string
		if(!dojo.isString(type)){
			return "";
		}
		var writer = this._getExportWriter(type, writerArgs);
		return this._goThroughGridData(this.grid.selection.getSelected(), writer);	//String
	},
	_buildRow: function(/* object */arg_obj,/* ExportWriter */writer){
		// summary:
		//		Use the given export writer(writer) to go through a single row
		//		which is given in the context object(arg_obj).
		// tags:
		//		private
		// returns:
		//		undefined
		var _this = this;
		dojo.forEach(arg_obj._views, function(view, vIdx){
			arg_obj.view = view;
			arg_obj.viewIdx = vIdx;
			if(writer.beforeView(arg_obj)){
				dojo.forEach(view.structure.cells, function(subrow, srIdx){
					arg_obj.subrow = subrow;
					arg_obj.subrowIdx = srIdx;
					if(writer.beforeSubrow(arg_obj)){
						dojo.forEach(subrow, function(cell, cIdx){
							if(arg_obj.isHeader && _this._isSpecialCol(cell)){
								arg_obj.spCols.push(cell.index);
							}
							arg_obj.cell = cell;
							arg_obj.cellIdx = cIdx;
							writer.handleCell(arg_obj);
						});
						writer.afterSubrow(arg_obj);
					}
				});
				writer.afterView(arg_obj);
			}
		});
	},
	_goThroughGridData: function(/* Array */items,/* ExportWriter */writer){
		// summary:
		//		Use the given export writer(writer) to go through the grid structure
		//		and the given rows(items), then return the writer output.
		// tags:
		//		private
		var grid = this.grid,
			views = dojo.filter(grid.views.views, function(view){
				return !(view instanceof dojox.grid._RowSelector);
			}),
			arg_obj = {
				'grid': grid,
				'isHeader': true,
				'spCols': [],
				'_views': views,
				'colOffset': (views.length < grid.views.views.length ? -1 : 0)
			};
		//go through header
		if(writer.beforeHeader(grid)){
			this._buildRow(arg_obj,writer);
			writer.afterHeader();
		}
		//go through content
		arg_obj.isHeader = false;
		if(writer.beforeContent(items)){
			dojo.forEach(items, function(item, rIdx){
				arg_obj.row = item;
				arg_obj.rowIdx = rIdx;
				if(writer.beforeContentRow(arg_obj)){
					this._buildRow(arg_obj, writer);
					writer.afterContentRow(arg_obj);
				}
			}, this);
			writer.afterContent();
		}
		return writer.toString();
	},
	_isSpecialCol: function(/* dojox.grid.__CellDef */header_cell){
		// summary:
		//		Row selectors and row indexes should be recognized and handled separately.
		// tags:
		//		private
		return header_cell.isRowSelector || header_cell instanceof dojox.grid.cells.RowIndex;	//Boolean
	},
	_getExportWriter: function(/* string */ fileType, /* object? */ writerArgs){
		// summary:
		//		Use the given export format type(fileType)
		//		and writer arguments(writerArgs) to create
		//		a ExportWriter and return it.
		// tags:
		//		private
		var writerName, cls,
			expCls = dojox.grid.enhanced.plugins.Exporter;
		if(expCls.writerNames){
			writerName = expCls.writerNames[fileType.toLowerCase()];
			cls = dojo.getObject(writerName);
			if(cls){
				var writer = new cls(writerArgs);
				writer.formatter = this.formatter;
				return writer;	//ExportWriter
			}else{
				throw new Error('Please make sure class "' + writerName + '" is required.');
			}
		}
		throw new Error('The writer for "' + fileType + '" has not been registered.');
	}
});
dojox.grid.enhanced.plugins.Exporter.registerWriter = function(/* string */fileType,/* string */writerClsName){
	// summary:
	//		Register a writer(writerClsName) to a export format type(fileType).
	//		This function separates the Exporter from all kinds of writers.
	// tags:
	//		public
	var expCls = dojox.grid.enhanced.plugins.Exporter;
	expCls.writerNames = expCls.writerNames || {};
	expCls.writerNames[fileType] = writerClsName;
};
dojox.grid.EnhancedGrid.registerPlugin(dojox.grid.enhanced.plugins.Exporter/*name:'exporter'*/);

}
