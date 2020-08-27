import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  ReplaceTexts,
  AngularFileUploaderConfig,
  UploadInfo
} from './ngx-file-uploader.types';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
  HttpEventType,
} from '@angular/common/http';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'ngx-file-uploader',
  templateUrl: './ngx-file-uploader.component.html',
  styleUrls: ['./ngx-file-uploader.component.css'],
})
export class NgxFileUploaderComponent implements OnChanges {
  // Inputs
  @Input()
  config: AngularFileUploaderConfig;

  @Input()
  resetUpload = false;

  // Outputs
  @Output()
  ApiResponse = new EventEmitter();

  @Output()
  everythingDone: EventEmitter<UploadInfo[]> = new EventEmitter<UploadInfo[]>();

  // Properties
  public theme: string;
  public id: number;
  public hideProgressBar: boolean;
  public maxSize: number;
  public uploadAPI: string;
  public method: string;
  public formatsAllowed: string;
  public multiple: boolean;
  public headers: HttpHeaders | { [header: string]: string | string[] };
  public params: HttpParams | { [param: string]: string | string[] };
  public responseType: string;
  public hideResetBtn: boolean;
  public hideSelectBtn: boolean;
  public allowedFiles: File[] = [];
  public notAllowedFiles: {
    fileName: string;
    fileSize: string;
    errorMsg: string;
  }[] = [];
  public Caption: string[] = [];
  public isAllowedFileSingle = true;
  public progressBarShow = false;
  public enableUploadBtn = false;
  public uploadMsg = false;
  public afterUpload = false;
  public uploadStarted = false;
  public uploadMsgText: string;
  public uploadMsgClass: string;
  public uploadPercent: number;
  public replaceTexts: ReplaceTexts;
  public currentUploads: any[] = [];
  public fileNameIndex = true;

  private idDate: number = +new Date();
  /* Subscriptions */
  private httpCallSubscription: Subscription;
  private destroy = new Subject();
  /**
   * constructor
   *
   * @param   {HttpClient}  http
   *
   */
  constructor(private http: HttpClient) {}
  /**
   * ngOnChanges
   *
   * @param   {SimpleChanges}  changes
   *
   * @return  {void}
   */
  public ngOnChanges(changes: SimpleChanges): void {
    // Track changes in Configuration and see if user has even provided Configuration.
    if (changes.config && this.config) {
      // Assign User Configurations to Library Properties.
      this.theme = this.config.theme || '';
      this.id =
        this.config.id ||
        parseInt((this.idDate / 10000).toString().split('.')[1], 10) +
          Math.floor(Math.random() * 20) * 10000;
      this.hideProgressBar = this.config.hideProgressBar || false;
      this.hideResetBtn = this.config.hideResetBtn || false;
      this.hideSelectBtn = this.config.hideSelectBtn || false;
      this.maxSize = (this.config.maxSize || 20) * 1024000; // mb to bytes.
      this.uploadAPI = this.config.uploadAPI.url;
      this.method = this.config.uploadAPI.method || 'POST';
      this.formatsAllowed =
        this.config.formatsAllowed || '.jpg,.png,.pdf,.docx,.txt,.gif,.jpeg';
      this.multiple = this.config.multiple || false;
      this.headers = this.config.uploadAPI.headers || {};
      this.params = this.config.uploadAPI.params || {};
      this.responseType = this.config.uploadAPI.responseType || null;
      this.fileNameIndex = this.config.fileNameIndex === false ? false : true;
      this.replaceTexts = {
        selectFileBtn: this.multiple ? 'Select Files' : 'Select File',
        resetBtn: 'Reset',
        uploadBtn: 'Upload',
        dragNDropBox: 'Drag N Drop',
        pleaseWaitMessage: 'Please wait until file is uploaded',
        attachPinBtn: this.multiple ? 'Attach Files...' : 'Attach File...',
        afterUploadMsg_success: 'Successfully Uploaded !',
        afterUploadMsg_error: 'Upload Failed !',
        sizeLimit: 'Size Limit',
      }; // default replaceText.
      if (this.config.replaceTexts) {
        // updated replaceText if user has provided any.
        this.replaceTexts = {
          ...this.replaceTexts,
          ...this.config.replaceTexts,
        };
      }
    }

    // Reset when resetUpload value changes from false to true.
    if (changes.resetUpload) {
      if (changes.resetUpload.currentValue === true) {
        this.resetFileUpload();
      }
    }

  }

  public ngOnDestroy(): void {
    this.destroy.next();
    this.destroy.complete();
  }

  /**
   * resetFileUpload
   * Reset following properties.
   *
   * @return  {void}
   */
  public resetFileUpload(): void {
    this.allowedFiles = [];
    this.Caption = [];
    this.notAllowedFiles = [];
    this.uploadMsg = false;
    this.enableUploadBtn = false;
  }

  /**
   * onChange hook
   *  - Check when user selects files.
   *
   * @param   {any}   event
   *
   * @return  {void}
   */
  public onChange(event: any): void {

    this.notAllowedFiles = [];
    const fileExtRegExp: RegExp = /(?:\.([^.]+))?$/;
    let fileList: FileList;

    if (this.afterUpload || !this.multiple) {
      this.allowedFiles = [];
      this.Caption = [];
      this.afterUpload = false;
    }

    if (event.type === 'drop') {
      fileList = event.dataTransfer.files;
    } else {
      fileList = event.target.files || event.srcElement.files;
    }

    // 'forEach' does not exist on 'filelist' that's why this good old 'for' is used.
    for (let i = 0; i < fileList.length; i++) {
      const currentFileExt = fileExtRegExp
        .exec(fileList[i].name)[1]
        .toLowerCase(); // Get file extension.
      const isFormatValid = this.formatsAllowed.includes(currentFileExt);

      const isSizeValid = fileList[i].size <= this.maxSize;

      // Check whether current file format and size is correct as specified in the configurations.
      if (isFormatValid && isSizeValid) {
        this.allowedFiles.push(fileList[i]);
      } else {
        this.notAllowedFiles.push({
          fileName: fileList[i].name,
          fileSize: this.convertSize(fileList[i].size),
          errorMsg: !isFormatValid ? 'Invalid format' : 'Invalid size',
        });
      }
    }

    // If there's any allowedFiles.
    if (this.allowedFiles.length > 0) {
      this.enableUploadBtn = true;
      // Upload the files directly if theme is attach pin (as upload btn is not there for this theme).
      if (this.theme === 'attachPin') {
        this.uploadFiles();
      }
    } else {
      this.enableUploadBtn = false;
    }

    this.uploadMsg = false;
    this.uploadStarted = false;
    this.uploadPercent = 0;
    event.target.value = null;
  }
  /**
   * uploadFiles
   *
   * @return  {void}
   */
  public uploadFiles(): void {
    this.progressBarShow = true;
    this.uploadStarted = true;
    this.notAllowedFiles = [];
    let isError = false;
    this.isAllowedFileSingle = this.allowedFiles.length <= 1;
    const formData = new FormData();

    // Add data to be sent in this request
    this.allowedFiles.forEach((file, i) => {
      formData.append(
        this.Caption[i] || 'file' + (this.fileNameIndex ? i : ''),
        this.allowedFiles[i]
      );
    });

    const options = {
      headers: this.headers,
      params: this.params,
    };

    if (this.responseType) {
       (options as any).responseType = this.responseType;
    }

    this.httpCallSubscription = this.http
      .request(this.method.toUpperCase(), this.uploadAPI, {
        body: formData,
        reportProgress: true,
        observe: 'events',
        ...options,
      }).pipe(takeUntil(this.destroy)).subscribe(
        (event) => {
          // Upload Progress
          if (event.type === HttpEventType.UploadProgress) {
            this.enableUploadBtn = false; // button should be disabled if process uploading
            const currentDone = event.loaded / event.total;
            this.uploadPercent = Math.round((event.loaded / event.total) * 100);
          } else if (event.type === HttpEventType.Response) {
            if (event.status === 200 || event.status === 201) {
              // Success
              this.progressBarShow = false;
              this.enableUploadBtn = false;
              this.uploadStarted = false;
              this.uploadMsg = true;
              this.afterUpload = true;
              if (!isError) {
                this.uploadMsgText = this.replaceTexts.afterUploadMsg_success;
                this.uploadMsgClass = 'text-success lead';
              }
            } else {
              // Failure
              isError = true;
              this.handleErrors();
            }

            this.ApiResponse.emit(event);
          } else {
            // console.log('Event Other: ', event);
          }
        },
        (error) => {
          // Failure
          isError = true;
          this.handleErrors();
          this.ApiResponse.emit(error);
        }
      );
  }
  /**
   * handleErrors
   *
   * @return  {void}
   */
  public handleErrors(): void {
    this.progressBarShow = false;
    this.enableUploadBtn = false;
    this.uploadMsg = true;
    this.afterUpload = true;
    this.uploadMsgText = this.replaceTexts.afterUploadMsg_error;
    this.uploadMsgClass = 'text-danger lead';
    this.uploadStarted = false;
  }
  /**
   * removeFile
   *
   * @param   {any}   i
   * @param   {any}   sfNa
   *
   * @return  {void}
   */
  public removeFile(i: any, sfNa: any): void {
    if (sfNa === 'sf') {
      this.allowedFiles.splice(i, 1);
      this.Caption.splice(i, 1);
    } else {
      this.notAllowedFiles.splice(i, 1);
    }

    if (this.allowedFiles.length === 0) {
      this.enableUploadBtn = false;
    }
  }
  /**
   * convertSize
   *
   * @param   {number}  fileSize
   *
   * @return  {string}
   */
  public convertSize(fileSize: number): string {
    return fileSize < 1024000
      ? (fileSize / 1024).toFixed(2) + ' KB'
      : (fileSize / 1024000).toFixed(2) + ' MB';
  }
  /**
   * attachpinOnclick
   *
   * @return  {void}
   */
  public attachpinOnclick(): void {
    const element = document.getElementById('sel' + this.id);
    if (element !== null) {
      element.click();
    }
  }
  /**
   * drop
   *
   * @param   {any}   event
   *
   * @return  {void}
   */
  public drop(event: any): void {
    event.stopPropagation();
    event.preventDefault();
    this.onChange(event);
  }
  /**
   * allowDrop
   *
   * @param   {any}   event
   *
   * @return  {void}
   */
  public allowDrop(event: any): void {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
  /**
   * cancelApiCall
   *
   * @return  {void}
   */
  public cancelApiCall(): void {
    if (this.httpCallSubscription) {
      this.httpCallSubscription.unsubscribe();
    }
  }
}
