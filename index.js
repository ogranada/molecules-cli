const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');
const { Command } = require('commander');
const Confirm = require('prompt-confirm');
const fs = require('fs');
const path = require('path');

const package = require('./package.json');

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

const getControllerContent = (
  modName,
  apiName,
) => `import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('/your/path/here/${apiName}')
export class ${modName}Controller {

  constructor(
    // @Inject() private injectedValue: IDomainElement,
  ) {
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  doSomethingWithAuth(): any {
    return {};
  }

}
`;

const getModuleContent = (
  modName,
  apiName,
) => `import { Module } from '@nestjs/common';
import { ${modName}Controller } from './infrastructure/${apiName}.controller';

@Module({
  imports: [
  ],
  exports: [
  ],
  providers: [
  ],
  controllers: [${modName}Controller]
})
export class ${modName}Module { }`;


const getModelContent = (
  modName,
  apiName,
  args
) => {
  const attributes = args.map(arg => arg.split(':')).map(elms => {
    if (elms.length < 2) {
      elms.push('any');
    }
    return elms;
  });
  const constructorValues = attributes.map(el => `readonly ${el[0]}: ${el[1]}`).join(',\n    ')
  const dtoValues = attributes.map(el => `${el[0]}: this.${el[0]}`).join(',\n      ')
  const extendValues = attributes.map(el => `patch.${el[0]} || this.${el[0]}`).join(',\n      ')
  const createAttrs = attributes.map(el => `dtoInfo.${el[0]}`).join(',\n      ')
  return `import { ${modName}Dto } from '../data-transfer-objects/${apiName}-dto';

export class ${modName} {

  constructor(
    ${constructorValues}
  ) {
  }

  asDTO(): ${modName}Dto {
    return {
      ${dtoValues}
    } as ${modName}Dto;
  }

  extend(patch: ${modName}): ${modName} {
    return new ${modName}(
      ${extendValues}
    );
  }

  static create(dtoInfo: ${modName}Dto): ${modName} {
    return new ${modName}(
      ${createAttrs}
    );
  }

}
`
};

const getDTOContent = (
  modName,
  apiName,
  args) => {
    const attributes = args.map(arg => arg.split(':')).map(elms => {
      if (elms.length < 2) {
        elms.push('any');
      }
      return elms;
    });
    const attributesText = attributes.map(el => `@IsOptional()\n  readonly ${el[0]}: ${el[1]}`).join(';\n  ')
    return `import { IsOptional } from 'class-validator';

export class ${modName}Dto {
  ${attributesText}
}
`};

const makeFolder = (name, children = []) => ({
  type: 'folder',
  name: name,
  children: [...children],
});

const makeFile = (name, content = '') => ({
  type: 'file',
  name,
  content,
});

const boundedFileStructure = [
  makeFolder('application'),
  makeFolder('domain', [
    makeFolder('data-transfer-objects'),
    makeFolder('models'),
    makeFolder('repositories'),
    makeFolder('value-objects'),
  ]),
  makeFolder('infrastructure', [makeFolder('repositories')]),
];

function createArchive(archive, simulate = false, root = '.') {
  const archivePath = path.join(root, archive.name);
  if (archive.type === 'folder') {
    if (!fs.existsSync(archivePath)) {
      console.log(chalk.greenBright(' *'), archivePath, ' created.');
      if (!simulate) {
        fs.mkdirSync(archivePath);
      }
    } else {
      console.log(' ~', chalk.gray(archivePath), chalk.red(' already exists.'));
    }
    archive.children.forEach(child =>
      createArchive(child, simulate, archivePath),
    );
  } else if (archive.type === 'file') {
    if (!fs.existsSync(archivePath)) {
      console.log(chalk.greenBright(' *'), archivePath, ' created.');
      if (!simulate) {
        fs.writeFileSync(archivePath, archive.content);
      }
    } else {
      console.log(' ~', chalk.gray(archivePath), chalk.red(' already exists.'));
    }
  }
}

function deleteArchive(dir, simulate=false) {
  try {
    if (!simulate) {
      fs.rmdirSync(dir, { recursive: true });
    }
    console.log(`Deleting ${dir}.`);
  } catch (err) {
    console.error(`Error while deleting ${dir}.`);
  }
}

function deleteElement(actionType, name) {
  const modName = toTitleCase(name).replace(/\s+/, '');
  const apiName = name.toLowerCase().replace(/\s+/, '-');
  if (actionType === 'boundedContext') {
    if (fs.existsSync(`./${modName}`)) {
      const prompt = new Confirm({
        message: `Do you like to remove the context ${modName}?`,
      });
      prompt.run().then(function(answer) {
        if (answer) {
          deleteArchive(modName, global.simulate);
          console.log(`Bounded context ${modName} deleted.`);
        }
      });
    } else {
      console.error(`Bounded context ${modName} does not exists.`);
    }
  } else if (actionType === 'controller') {
    const controllerName = `${apiName}.controller.ts`;
    if (fs.existsSync(`./${controllerName}`)) {
      const prompt = new Confirm({
        message: `Do you like to remove the controller ${modName}?`,
      });
      prompt.run().then(function(answer) {
        if (answer) {
          deleteArchive(controllerName, global.simulate);
          console.log(`Controller ${modName} deleted.`);
        }
      });
    } else {
      console.error(`Controller ${modName} does not exists.`);
    }
  } else if (actionType === 'domainModel') {
    const modelName = `${apiName}.ts`;
    const dtoName = `${apiName}-dto.ts`;
    if (fs.existsSync(`./domain/models/${modelName}`) && fs.existsSync(`./domain/data-transfer-objects/${dtoName}`)) {
      console.log('Asociated files:');
      console.log(`  - domain/models/${modelName}`);
      console.log(`  - domain/data-transfer-objects/${dtoName}`);
      console.log();    
      const prompt = new Confirm({
        message: `Do you like to remove the domain model ${modName} and its dto file?`,
      });
      prompt.run().then(function(answer) {
        if (answer) {
          deleteArchive(`./domain/models/${modelName}`, global.simulate);
          deleteArchive(`./domain/data-transfer-objects/${dtoName}`, global.simulate);
          console.log(`Model ${modName} deleted.`);
        }
      });
    } else {
      console.error(`Model ${modName} does not exists.`);
    }
  }
}

function createElement(actionType, name, args) {
  const modName = toTitleCase(name).replace(/\s+/, '');
  const apiName = name.toLowerCase().replace(/\s+/, '-');
  if (actionType === 'boundedContext') {
    const newFileStructure = [
      ...boundedFileStructure,
      makeFile(`${apiName}.module.ts`, getModuleContent(modName, apiName)),
    ];
    newFileStructure[2].children.push(
      makeFile(
        `${apiName}.controller.ts`,
        getControllerContent(modName, apiName),
      ),
    );
    createArchive(makeFolder(modName, newFileStructure), global.simulate);
    console.log(`Bounded context ${modName} created.`);
  } else if (actionType === 'controller') {
    if (fs.existsSync('infrastructure')) {
      createArchive(
        makeFile(
          `${apiName}.controller.ts`,
          getControllerContent(modName, apiName),
        ),
        global.simulate,
      );
      console.log(`Controller ${modName} created.`);
    } else {
      console.error('Invalid bounded context, current folder does not contains infrastructure space.')
    }
  } else if (actionType === 'domainModel') {
    if (fs.existsSync('domain')) {
      createArchive(
        makeFolder('domain', [
          makeFolder('models', [
            makeFile(
              `${apiName}.ts`,
              getModelContent(modName, apiName, args),
            )
          ]),
          makeFolder('data-transfer-objects', [
            makeFile(
              `${apiName}-dto.ts`,
              getDTOContent(modName, apiName, args),
            )
          ])
        ]),
        global.simulate,
      );
      console.log(`Domain model ${modName} created.`);
    } else {
      console.error('Invalid bounded context, current folder does not contains domain space.')
    }
  }
}

function banner() {
  clear();
  console.log(
    chalk.greenBright(
      figlet.textSync('Molecules', {
        font: 'Swan',
        horizontalLayout: 'full',
      }),
    ) + chalk.green('\nClean architecture tool for typescript\n\n'),
  );
}

function main() {
  const program = new Command(package.name);
  program
    .option('-s, --simulate', 'Simulate execution')
    .option('-b, --create-bounded-context <name>', 'Create a bounded context')
    .option('-u, --delete-bounded-context <name>', 'Delete a bounded context')
    .option('-c, --create-controller <name>', 'Create a controller')
    .option('-r, --delete-controller <name>', 'Delete a controller')
    .option('-d, --create-domain-model <name> [attrs]', 'Create a domain model')
    .option('-l, --delete-domain-model <name>', 'Create a domain model')
    .version(package.version);
  banner();
  program.parse(process.argv);
  global.simulate = program.simulate;
  if (program.createBoundedContext) {
    createElement('boundedContext', program.createBoundedContext, program.args);
    return;
  }
  if (program.deleteBoundedContext) {
    deleteElement('boundedContext', program.deleteBoundedContext);
    return;
  }
  if (program.createController) {
    createElement('controller', program.createController, program.args);
    return;
  }
  if (program.deleteController) {
    deleteElement('controller', program.deleteController);
    return;
  }
  if (program.createDomainModel) {
    createElement('domainModel', program.createDomainModel, program.args);
    return;
  }
  if (program.deleteDomainModel) {
    deleteElement('domainModel', program.deleteDomainModel);
    return;
  }
  console.log('Nothing to do...');
}

main();
