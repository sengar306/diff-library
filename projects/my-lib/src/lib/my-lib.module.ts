import { NgModule } from '@angular/core';
import { MyLibComponent } from './my-lib.component';

import { DiffEditorComponent } from './diff-editor/diff-editor.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';




@NgModule({
  declarations: [
    MyLibComponent,
    DiffEditorComponent,

  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    MyLibComponent,DiffEditorComponent
  ]
})
export class MyLibModule { }
